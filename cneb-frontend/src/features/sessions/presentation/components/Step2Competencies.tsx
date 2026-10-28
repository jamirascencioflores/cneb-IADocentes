import { UseFormReturn } from "react-hook-form";
import { SessionDraftFormData } from "../../domain/session-form.schema";
import { CrossCuttingTheme } from "../../domain/session.types";
import { Textarea } from "@/shared/components/ui/textarea";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { CNEB_CURRICULUM_DATA } from "@/features/curriculum/domain/cneb-curriculum.data";

interface Step2Props {
  form: UseFormReturn<SessionDraftFormData>;
}

const THEMES: { id: CrossCuttingTheme; label: string; values: string }[] = [
  {
    id: "RIGHTS",
    label: "Enfoque de Derechos",
    values: "Libertad y responsabilidad, Diálogo y concertación",
  },
  {
    id: "INCLUSIVE",
    label: "Enfoque Inclusivo o de Atención a la diversidad",
    values: "Respeto por las diferencias, Equidad en la enseñanza",
  },
  {
    id: "INTERCULTURAL",
    label: "Enfoque Intercultural",
    values: "Respeto a la identidad cultural, Diálogo intercultural",
  },
  {
    id: "ENVIRONMENTAL",
    label: "Enfoque Ambiental",
    values:
      "Solidaridad planetaria y equidad intergeneracional, Justicia y solidaridad",
  },
  {
    id: "COMMON_GOOD",
    label: "Enfoque Orientación al Bien Común",
    values: "Empatía, Solidaridad, Responsabilidad colectiva",
  },
  {
    id: "EXCELLENCE",
    label: "Enfoque Búsqueda de la Excelencia",
    values: "Flexibilidad y apertura, Superación personal",
  },
];

export function Step2Competencies({ form }: Step2Props) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = form;
  const currentAreaId = watch("areaId");
  const selectedCompetencies = watch("selectedCompetencies") || [];
  const currentTheme = watch("crossCuttingTheme");

  const areaCurriculum =
    CNEB_CURRICULUM_DATA[currentAreaId] || CNEB_CURRICULUM_DATA["COM"];
  const availableCompetencies = areaCurriculum.competencies;

  const toggleCompetency = (
    compId: string,
    defaultPerf: string,
    perfId: string,
  ) => {
    const exists = selectedCompetencies.some((c) => c.competencyId === compId);

    if (exists) {
      if (selectedCompetencies.length === 1) {
        return;
      }
      const filtered = selectedCompetencies.filter(
        (c) => c.competencyId !== compId,
      );
      if (filtered.length > 0 && !filtered.some((c) => c.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      setValue("selectedCompetencies", filtered, { shouldValidate: true });
    } else {
      const newEntry = {
        competencyId: compId,
        performanceId: perfId,
        precisedPerformance: defaultPerf,
        isPrimary: selectedCompetencies.length === 0,
      };
      setValue("selectedCompetencies", [...selectedCompetencies, newEntry], {
        shouldValidate: true,
      });
    }
  };

  const updatePrecisedPerformance = (compId: string, text: string) => {
    const updated = selectedCompetencies.map((item) =>
      item.competencyId === compId
        ? { ...item, precisedPerformance: text }
        : item,
    );
    setValue("selectedCompetencies", updated, { shouldValidate: true });
  };

  return (
    <div className="space-y-5 rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between border-b pb-3">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
            2
          </span>
          Paso 2: Competencias y Enfoques CNEB
        </h3>
        <span className="text-xs font-medium text-slate-500">
          Currículo Nacional Oficial ({areaCurriculum.name})
        </span>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-semibold text-slate-700">
          Competencias del Área (Selecciona las a desarrollar):
        </label>

        {errors.selectedCompetencies && (
          <p className="text-xs text-rose-500 font-medium">
            {errors.selectedCompetencies.message}
          </p>
        )}

        <div className="space-y-3">
          {availableCompetencies.map((comp) => {
            const selectedItem = selectedCompetencies.find(
              (c) => c.competencyId === comp.id,
            );
            const isSelected = !!selectedItem;

            return (
              <div
                key={comp.id}
                className={`rounded-lg border p-4 transition-all ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50/30"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() =>
                      toggleCompetency(
                        comp.id,
                        comp.defaultPerformance,
                        comp.defaultPerformanceId,
                      )
                    }
                    id={comp.id}
                    className="mt-1"
                  />
                  <div className="space-y-1.5 flex-1">
                    <label
                      htmlFor={comp.id}
                      className="text-sm font-bold text-slate-900 cursor-pointer"
                    >
                      {comp.code} {comp.title}
                    </label>
                    <p className="text-xs text-slate-600">{comp.description}</p>

                    <div className="pt-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Capacidades Movilizadas:
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {comp.capacities.map((cap) => (
                          <span
                            key={cap.id}
                            className="rounded bg-slate-200/70 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                          >
                            • {cap.title}
                          </span>
                        ))}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="pt-3 space-y-1">
                        <label className="text-xs font-semibold text-slate-800">
                          Desempeño Precisado / Criterios de la sesión:
                        </label>
                        <Textarea
                          rows={3}
                          value={selectedItem.precisedPerformance}
                          onChange={(e) =>
                            updatePrecisedPerformance(comp.id, e.target.value)
                          }
                          placeholder="Redacte o ajuste el desempeño precisado alineado a la evidencia..."
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-700">
          Enfoque Transversal Priorizado (CNEB):
        </label>
        <select
          value={currentTheme}
          onChange={(e) => {
            const val = e.target.value as CrossCuttingTheme;
            setValue("crossCuttingTheme", val, { shouldValidate: true });
            const found = THEMES.find((t) => t.id === val);
            if (found) {
              setValue("crossCuttingValues", found.values, {
                shouldValidate: true,
              });
            }
          }}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {THEMES.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.label} ({theme.values})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
