import { UseFormReturn } from "react-hook-form";
import { SessionDraftFormData } from "../../domain/session-form.schema";
import { Input } from "@/shared/components/ui/input";
import { Checkbox } from "@/shared/components/ui/checkbox";

interface Step3Props {
  form: UseFormReturn<SessionDraftFormData>;
}

const DUA_ITEMS = [
  {
    id: "Apoyos visuales estructurados",
    title: "Apoyos visuales estructurados",
    desc: "Organizadores gráficos y plantillas con conectores lógicos de argumentación.",
  },
  {
    id: "Consignas y tiempos escalonados",
    title: "Consignas y tiempos escalonados",
    desc: "Segmentación en pasos guiados de 3 a 5 min para redacción de argumentos.",
  },
  {
    id: "Dinámicas neurodidácticas",
    title: "Dinámicas neurodidácticas",
    desc: "Pausas activas y activación lúdica de saberes previos con tarjetas de postura.",
  },
  {
    id: "Múltiples formatos de expresión",
    title: "Múltiples formatos de expresión",
    desc: "Opciones de participación orales, vocería grupal y fichas gráficas de síntesis.",
  },
];

export function Step3DuaAndInstrument({ form }: Step3Props) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;
  const hasDua = watch("hasDuaInclusion");
  const currentCategories = watch("duaCategories") || [];
  const appendTable = watch("appendTableToDocument");

  const toggleCategory = (catId: string) => {
    const updated = currentCategories.includes(catId)
      ? currentCategories.filter((c) => c !== catId)
      : [...currentCategories, catId];
    setValue("duaCategories", updated, { shouldValidate: true });
  };

  return (
    <div className="space-y-5 rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between border-b pb-3">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
            3
          </span>
          Paso 3: Tema, DUA e Instrumento
        </h3>
        <span className="text-xs font-medium text-emerald-700 font-semibold">
          Inclusión Efectiva
        </span>
      </div>

      {/* Título de la sesión */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-700">
          Título y Situación Significativa de la Sesión:
        </label>
        <Input
          {...register("sessionTitle")}
          placeholder="Ej. El debate argumentativo sobre el uso de redes sociales"
        />
        {errors.sessionTitle && (
          <p className="text-xs text-rose-500">{errors.sessionTitle.message}</p>
        )}
      </div>

      {/* DUA Switcher y Cards */}
      <div className="space-y-3 rounded-lg border border-slate-200 p-4 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={hasDua}
              onCheckedChange={(val) =>
                setValue("hasDuaInclusion", !!val, { shouldValidate: true })
              }
              id="dua-toggle"
            />
            <label
              htmlFor="dua-toggle"
              className="text-xs font-bold text-slate-800 cursor-pointer"
            >
              Habilitar adaptaciones DUA / NEE
            </label>
          </div>
          {hasDua && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              {currentCategories.length} Casillas Activas
            </span>
          )}
        </div>

        {hasDua && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            {DUA_ITEMS.map((item) => {
              const isCatSelected = currentCategories.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleCategory(item.id)}
                  className={`flex items-start gap-2.5 rounded-md border p-2.5 text-left cursor-pointer transition-all ${
                    isCatSelected
                      ? "border-emerald-500 bg-emerald-50/40"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <Checkbox
                    checked={isCatSelected}
                    className="mt-0.5 pointer-events-none"
                  />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-slate-600 leading-tight">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Instrumento de evaluación */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-700">
          Instrumento de Evaluación Formativa:
        </label>
        <select
          {...register("instrumentType")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="CHECKLIST">Lista de cotejo</option>
          <option value="RUBRIC">Rúbrica de evaluación</option>
          <option value="SELF_EVALUATION">Ficha de autoevaluación</option>
          <option value="OBSERVATION_GUIDE">Guía de observación</option>
        </select>

        <div className="flex items-center gap-2 pt-2">
          <Checkbox
            checked={appendTable}
            onCheckedChange={(val) =>
              setValue("appendTableToDocument", !!val, { shouldValidate: true })
            }
            id="append-table"
          />
          <label
            htmlFor="append-table"
            className="text-xs text-slate-700 cursor-pointer"
          >
            Generar anexo con tabla de instrumento al final
          </label>
        </div>
      </div>
    </div>
  );
}
