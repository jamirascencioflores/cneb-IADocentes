import { useState, useMemo, useEffect, useRef } from "react";
import { useSessionDraftForm } from "../../application/useSessionDraftForm";
import { useSessionPreview } from "../../application/useSessionPreview";
import { useExportDocx } from "../../application/useExportDocx";
import { sessionRepository } from "../../infrastructure/http-session.repository";
import { SessionPreviewEntity } from "../../domain/session.types";
import { Step1GeneralData } from "../components/Step1GeneralData";
import { Step2Competencies } from "../components/Step2Competencies";
import { Step3DuaAndInstrument } from "../components/Step3DuaAndInstrument";
import { MineduA4Document } from "../components/preview/MineduA4Document";
import { Button } from "@/shared/components/ui/button";
import { RefreshCw, RotateCcw } from "lucide-react";
import { DUA_CATEGORY_DETAILS } from "@/features/curriculum/domain/cneb-labels";
import { useCurriculum } from "@/features/curriculum/application/useCurriculum";
import { reconcileCompetencies } from "@/features/curriculum/application/reconcile-competencies";
import {
  persistSnapshot,
  type SavedSnapshot,
} from "../../application/session-snapshot";
import { InstitutionalProfileForm } from "@/features/profile/presentation/components/InstitutionalProfileForm";
import { ProblemDetailsDialog } from "@/shared/components/feedback/ProblemDetailsDialog";
import { ProblemDetails } from "@/shared/types/problem-details.types";
import { TeacherNavbar } from "@/features/profile/presentation/components/TeacherNavbar";
import { useTeacherContext } from "@/features/profile/application/useTeacherContext";

const initialAiContent = {
  learningPurpose:
    "Participar en un debate argumentativo escolar defendiendo posturas fundamentadas con réplicas asertivas.",
  evidenceDescription:
    "Participación en el debate escolar formal con rúbrica/lista de cotejo.",
  didacticMoments: [
    {
      momentType: "START" as const,
      allocatedMinutes: 15,
      pedagogicalProcesses: "Motivación, Saberes Previos y Propósito",
      activitiesDescription:
        "El docente saluda e ingresa con dos afirmaciones polémicas proyectadas en pizarra. Se recoge saberes previos mediante lluvia de ideas. Se presenta el propósito del día y los 5 criterios de la lista de cotejo.",
      duaNotes:
        "[DUA — Principio de Representación]: Información presentada con apoyos visuales y tarjetas léxicas para asegurar la comprensión de todos los estudiantes.",
      orderIndex: 1,
    },
    {
      momentType: "DEVELOPMENT" as const,
      allocatedMinutes: 65,
      pedagogicalProcesses: "Gestión y Acompañamiento de Competencias",
      activitiesDescription:
        "Lectura y análisis de fuentes en equipos de 4. Aplicación práctica mediante la dinámica del Círculo Socrático: intercambio de argumentos, réplicas asertivas y contrarréplicas (35 min). Monitoreo docente y retroalimentación descriptiva oportuna.",
      duaNotes:
        "[DUA — Principio de Acción y Expresión]: Consignas escalonadas y opciones de respuesta gráfica u oral antes del producto final.",
      orderIndex: 2,
    },
    {
      momentType: "CLOSING" as const,
      allocatedMinutes: 10,
      pedagogicalProcesses: "Metacognición y Transferencia",
      activitiesDescription:
        "Socialización breve de conclusiones en plenario. Preguntas orientadoras: ¿Qué aprendimos hoy? ¿Cómo sustentamos nuestros argumentos? ¿Qué dificultades encontramos al responder réplicas?",
      duaNotes: null,
      orderIndex: 3,
    },
  ],
  criteria: [
    {
      criterionNumber: 1,
      description:
        "Adecúa su postura oral al propósito comunicativo y al auditorio.",
    },
    {
      criterionNumber: 2,
      description:
        "Sustenta argumentos sólidos contrastando información de fuentes confiables.",
    },
    {
      criterionNumber: 3,
      description: "Emplea recursos no verbales y modulación de voz.",
    },
    {
      criterionNumber: 4,
      description: "Responde con réplicas asertivas ante objeciones.",
    },
    {
      criterionNumber: 5,
      description:
        "Mantiene una actitud de escucha activa y respeto a los turnos de palabra.",
    },
  ],
};

export function SessionPlannerPage() {
  const {
    user,
    institution,
    profileMissing,
    isLoading: contextLoading,
    error: contextError,
  } = useTeacherContext();
  const form = useSessionDraftForm();
  const previewMutation = useSessionPreview();
  const exportMutation = useExportDocx();

  const [aiGeneratedData, setAiGeneratedData] =
    useState<Partial<SessionPreviewEntity> | null>(null);

  const [activeProblem, setActiveProblem] = useState<ProblemDetails | null>(
    null,
  );

  const formValues = form.watch();
  const currentAreaId = formValues.areaId;

  const curriculum = useCurriculum(currentAreaId, formValues.gradeLevel);
  const savedSnapshot = useRef<SavedSnapshot | null>(null);
  const exporting = useRef(false);
  const generationSequence = useRef(0);
  const [generatedFor, setGeneratedFor] = useState<string | null>(null);
  const formFingerprint = JSON.stringify(formValues);
  const generationIsCurrent = generatedFor === formFingerprint;

  useEffect(() => {
    if (!curriculum.data) return;
    const selected = form.getValues("selectedCompetencies");
    const reconciled = reconcileCompetencies(selected, curriculum.data);
    if (JSON.stringify(selected) !== JSON.stringify(reconciled)) {
      form.setValue("selectedCompetencies", reconciled, {
        shouldValidate: true,
      });
    }
  }, [curriculum.data, form]);

  // Fusión reactiva en vivo para la vista A4
  const livePreviewData: SessionPreviewEntity = useMemo(() => {
    const areaCurriculum = {
      name: curriculum.data?.areaName ?? formValues.areaId,
      competencies: curriculum.data?.competencies ?? [],
    };
    const areaTitle = areaCurriculum.name;

    const competencies = (formValues.selectedCompetencies || []).map((c) => {
      const foundInCatalog = areaCurriculum.competencies.find(
        (ac) => ac.id === c.competencyId,
      );
      return {
        competencyId: c.competencyId,
        competencyTitle: foundInCatalog?.title || "Competencia CNEB",
        capacities: foundInCatalog?.capacities.map((cap) => cap.title) || [
          "Capacidad oficial",
        ],
        performanceId: c.performanceId,
        precisedPerformance: c.precisedPerformance,
        isPrimary: c.isPrimary,
      };
    });

    const totalMinutes =
      formValues.pedagogicalDuration === "MINUTES_45"
        ? 45
        : formValues.pedagogicalDuration === "MINUTES_135"
          ? 135
          : 90;
    const startMin = totalMinutes === 45 ? 10 : 15;
    const closeMin = totalMinutes === 45 ? 5 : 10;
    const devMin = totalMinutes - startMin - closeMin;

    const activeDuaCategories = formValues.hasDuaInclusion
      ? formValues.duaCategories || []
      : [];

    const startDuaNotes = activeDuaCategories
      .filter(
        (cat: string) =>
          cat === "Apoyos visuales estructurados" ||
          cat === "Dinámicas neurodidácticas",
      )
      .map(
        (cat: string) =>
          `[DUA — ${DUA_CATEGORY_DETAILS[cat]?.principle}]: ${DUA_CATEGORY_DETAILS[cat]?.note}`,
      )
      .join(" ");

    const devDuaNotes = activeDuaCategories
      .filter(
        (cat: string) =>
          cat === "Consignas y tiempos escalonados" ||
          cat === "Múltiples formatos de expresión",
      )
      .map(
        (cat: string) =>
          `[DUA — ${DUA_CATEGORY_DETAILS[cat]?.principle}]: ${DUA_CATEGORY_DETAILS[cat]?.note}`,
      )
      .join(" ");

    const defaultMoments = [
      {
        momentType: "START" as const,
        allocatedMinutes: startMin,
        pedagogicalProcesses:
          "Motivación, Saberes Previos y Conflicto Cognitivo",
        activitiesDescription:
          aiGeneratedData?.didacticMoments?.[0]?.activitiesDescription ||
          initialAiContent.didacticMoments[0].activitiesDescription,
        duaNotes: startDuaNotes || null,
        orderIndex: 1,
      },
      {
        momentType: "DEVELOPMENT" as const,
        allocatedMinutes: devMin,
        pedagogicalProcesses:
          "Gestión y Acompañamiento del Desarrollo de Competencias",
        activitiesDescription:
          aiGeneratedData?.didacticMoments?.[1]?.activitiesDescription ||
          initialAiContent.didacticMoments[1].activitiesDescription,
        duaNotes: devDuaNotes || null,
        orderIndex: 2,
      },
      {
        momentType: "CLOSING" as const,
        allocatedMinutes: closeMin,
        pedagogicalProcesses: "Evaluación y Metacognición",
        activitiesDescription:
          aiGeneratedData?.didacticMoments?.[2]?.activitiesDescription ||
          initialAiContent.didacticMoments[2].activitiesDescription,
        duaNotes: null,
        orderIndex: 3,
      },
    ];

    return {
      id: aiGeneratedData?.id || "preview-session-id",
      areaId: formValues.areaId,
      areaName: areaTitle,
      gradeLevel: formValues.gradeLevel,
      sections: formValues.sections,
      pedagogicalDuration: formValues.pedagogicalDuration,
      unitTitle: formValues.unitTitle,
      sessionTitle: formValues.sessionTitle,
      learningPurpose:
        aiGeneratedData?.learningPurpose || initialAiContent.learningPurpose,
      evidenceDescription:
        aiGeneratedData?.evidenceDescription ||
        initialAiContent.evidenceDescription,
      crossCuttingTheme: formValues.crossCuttingTheme,
      crossCuttingValues: formValues.crossCuttingValues,
      hasDuaInclusion: formValues.hasDuaInclusion,
      duaCategories: formValues.duaCategories,
      materialsAndResources: formValues.materialsAndResources,
      evaluationDeclaration:
        aiGeneratedData?.evaluationDeclaration ??
        "Genera la sesión para obtener su evaluación.",
      competencies:
        competencies.length > 0
          ? competencies
          : [
              {
                competencyId: "COM_C01",
                competencyTitle: "Se comunica oralmente en su lengua materna",
                capacities: [
                  "Obtiene información del texto oral",
                  "Infiere e interpreta información del texto oral",
                ],
                performanceId: "PERF_COM_01_3G", // <-- ID válido de BD
                precisedPerformance:
                  "Seleccione al menos una competencia en el Paso 2.",
                isPrimary: true,
              },
            ],
      didacticMoments: aiGeneratedData?.didacticMoments || defaultMoments,
      instrument: {
        instrumentType: formValues.instrumentType,
        evaluatedEvidence: aiGeneratedData?.evidenceDescription ?? "",
        appendTableToDocument: formValues.appendTableToDocument,
        criteria:
          aiGeneratedData?.instrument?.criteria || initialAiContent.criteria,
      },
    };
  }, [formValues, aiGeneratedData, curriculum.data]);

  const handleRefreshPreview = () =>
    form.handleSubmit(async (data) => {
      try {
        const sequence = ++generationSequence.current;
        const snapshot = JSON.stringify(data);
        const generated = await previewMutation.mutateAsync(data);
        if (
          sequence !== generationSequence.current ||
          snapshot !== JSON.stringify(form.getValues())
        )
          return;
        setAiGeneratedData(generated);
        setGeneratedFor(snapshot);
      } catch (err: unknown) {
        if (err && typeof err === "object" && "problem" in err) {
          setActiveProblem((err as { problem: ProblemDetails }).problem);
        } else {
          setActiveProblem({
            type: "about:blank",
            title: "No se pudo generar la sesión",
            status: 502,
            detail: err instanceof Error ? err.message : "Intenta nuevamente.",
          });
        }
      }
    })();

  const [isSaving, setIsSaving] = useState(false);

  const handleExport = async () => {
    if (
      exporting.current ||
      !generationIsCurrent ||
      !curriculum.data ||
      contextError ||
      contextLoading ||
      profileMissing
    )
      return;
    exporting.current = true;
    setIsSaving(true);
    try {
      if (!(await form.trigger())) return;
      const snapshot = await persistSnapshot(
        livePreviewData,
        savedSnapshot.current,
        (preview) => sessionRepository.saveSession(preview),
      );
      savedSnapshot.current = snapshot;
      await exportMutation.mutateAsync({
        sessionId: snapshot.id,
        sessionTitle: livePreviewData.sessionTitle,
      });
    } catch (err: unknown) {
      if (err && typeof err === "object" && "problem" in err) {
        setActiveProblem((err as { problem: ProblemDetails }).problem);
      } else {
        setActiveProblem({
          type: "about:blank",
          title: "Error al exportar sesión",
          status: 500,
          detail:
            (err as Error)?.message ||
            "No se pudo completar la exportación del documento.",
        });
      }
    } finally {
      exporting.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TeacherNavbar />
      <div className="px-4 pt-4">
        <InstitutionalProfileForm />
        {contextError && (
          <p role="alert" className="text-red-700">
            No se pudieron cargar los datos de tu cuenta. Recarga la página para
            reintentar.
          </p>
        )}
        {!generationIsCurrent && (
          <p role="status" className="text-sm text-amber-800">
            Borrador: genera o actualiza la sesión con IA antes de descargar.
            Los cambios requieren una nueva generación.
          </p>
        )}
      </div>

      {/* Main Split-Screen Container */}
      <main className="flex-1 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1700px] mx-auto w-full">
        {/* Panel Izquierdo: Formulario */}
        <div className="lg:col-span-7 space-y-6">
          <div className="border-b pb-2">
            <h1 className="text-xl font-extrabold text-slate-900">
              Planificador de Sesiones de Aprendizaje
            </h1>
            <p className="text-xs text-slate-600">
              Formulario guiado con alineamiento curricular estricto a la RVM N°
              094-2020-MINEDU y adaptaciones inclusivas DUA.
            </p>
          </div>

          <form className="space-y-6">
            <Step1GeneralData form={form} />
            <Step2Competencies form={form} />
            <Step3DuaAndInstrument form={form} />

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  form.reset();
                  generationSequence.current += 1;
                  setAiGeneratedData(null);
                  setGeneratedFor(null);
                  savedSnapshot.current = null;
                }}
                className="gap-1.5 text-xs text-slate-600"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restablecer Formulario
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleRefreshPreview}
                disabled={
                  previewMutation.isPending ||
                  curriculum.isPending ||
                  curriculum.isError ||
                  !formValues.selectedCompetencies.length
                }
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${previewMutation.isPending ? "animate-spin" : ""}`}
                />
                {previewMutation.isPending
                  ? "Generando con IA..."
                  : "Actualizar Vista Previa en Vivo"}
              </Button>
            </div>
          </form>
        </div>

        {/* Panel Derecho: Vista A4 */}
        <div className="lg:col-span-5 lg:sticky lg:top-16 h-[calc(100vh-5rem)]">
          <MineduA4Document
            data={livePreviewData}
            teacherName={institution.teacherFullName || user.fullName}
            schoolName={institution.schoolName}
            ugelText={`${institution.drelm} • ${institution.ugel}`}
            isLoading={previewMutation.isPending}
            isDownloading={exportMutation.isPending || isSaving}
            canDownload={
              generationIsCurrent &&
              !profileMissing &&
              !contextError &&
              !contextLoading &&
              curriculum.isSuccess
            }
            onDownload={handleExport}
          />
        </div>
      </main>

      {/* Modal global de captura RFC 7807 */}
      <ProblemDetailsDialog
        problem={activeProblem}
        onClose={() => setActiveProblem(null)}
      />
    </div>
  );
}
