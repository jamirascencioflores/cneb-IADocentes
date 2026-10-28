import { useState, useMemo, useEffect } from "react";
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
import { CNEB_CURRICULUM_DATA } from "@/features/curriculum/domain/cneb-curriculum.data";
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
  const { user, institution } = useTeacherContext();
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

  // Reset reactivo de competencias al cambiar de Área en Paso 1
  useEffect(() => {
    const areaCurriculum = CNEB_CURRICULUM_DATA[currentAreaId];
    if (areaCurriculum && areaCurriculum.competencies.length > 0) {
      const currentSelected = form.getValues("selectedCompetencies") || [];
      const belongsToArea = currentSelected.some((c) =>
        areaCurriculum.competencies.some((ac) => ac.id === c.competencyId),
      );

      if (!belongsToArea) {
        const firstComp = areaCurriculum.competencies[0];
        form.setValue("selectedCompetencies", [
          {
            competencyId: firstComp.id,
            performanceId: firstComp.defaultPerformanceId,
            precisedPerformance: firstComp.defaultPerformance,
            isPrimary: true,
          },
        ]);
      }
    }
  }, [currentAreaId, form]);

  // Fusión reactiva en vivo para la vista A4
  const livePreviewData: SessionPreviewEntity = useMemo(() => {
    const areaCurriculum =
      CNEB_CURRICULUM_DATA[formValues.areaId] || CNEB_CURRICULUM_DATA["COM"];
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
    const closeMin = 10;
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
      evaluationDeclaration: `La evaluación será formativa para acompañar el desarrollo de las competencias del área de ${areaTitle}.`,
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
        evaluatedEvidence: "Evidencia de desempeño de la sesión",
        appendTableToDocument: formValues.appendTableToDocument,
        criteria:
          aiGeneratedData?.instrument?.criteria || initialAiContent.criteria,
      },
    };
  }, [formValues, aiGeneratedData]);

  const handleRefreshPreview = form.handleSubmit(async (data) => {
    try {
      const generated = await previewMutation.mutateAsync(data);
      setAiGeneratedData(generated);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "problem" in err) {
        setActiveProblem((err as { problem: ProblemDetails }).problem);
      }
    }
  });

  const [isSaving, setIsSaving] = useState(false);

  // 1. Declarar como type guard (id is string)
  const isValidUuid = (id?: string): id is string => {
    return Boolean(
      id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      ),
    );
  };

  const handleExport = async () => {
    try {
      let targetSessionId = livePreviewData.id;

      // Si no es un UUID válido, se persiste primero
      if (!isValidUuid(targetSessionId)) {
        setIsSaving(true);
        const persistedId =
          await sessionRepository.saveSession(livePreviewData);
        targetSessionId = persistedId;

        setAiGeneratedData((prev) => ({
          ...(prev || {}),
          id: persistedId,
        }));
      }

      // Verificación de nulidad para satisfacer el compilador
      if (!targetSessionId) {
        throw new Error(
          "No se pudo determinar el identificador de la sesión para exportar.",
        );
      }

      // 2. Aquí TypeScript ya sabe que targetSessionId es un string garantizado
      await exportMutation.mutateAsync({
        sessionId: targetSessionId,
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
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TeacherNavbar />

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
                  setAiGeneratedData(null);
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
                disabled={previewMutation.isPending}
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
            teacherName={user.fullName}
            schoolName={institution.schoolName}
            ugelText={`${institution.drelm} • ${institution.ugel}`}
            isLoading={previewMutation.isPending}
            isDownloading={exportMutation.isPending || isSaving}
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
