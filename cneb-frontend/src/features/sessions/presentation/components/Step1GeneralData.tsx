import { UseFormReturn } from "react-hook-form";
import { SessionDraftFormData } from "../../domain/session-form.schema";
import { GradeLevel, PedagogicalDuration } from "../../domain/session.types";
import { Input } from "@/shared/components/ui/input";
import {
  BookOpen,
  Briefcase,
  Calculator,
  Globe,
  Atom,
  Shield,
  Plus,
  X,
} from "lucide-react";
import { useState } from "react";
import { useCurriculumAreas } from "@/features/curriculum/application/useCurriculum";

interface Step1Props {
  form: UseFormReturn<SessionDraftFormData>;
}

const AREAS = [
  { id: "COM", name: "Comunicación", icon: BookOpen },
  { id: "EPT", name: "EPT (Educación para el Trabajo)", icon: Briefcase },
  { id: "MAT", name: "Matemática", icon: Calculator },
  { id: "CCSS", name: "Ciencias Sociales", icon: Globe },
  { id: "CYT", name: "Ciencia y Tecnología", icon: Atom },
  { id: "DPCC", name: "DPCC", icon: Shield },
];

const GRADES: { id: GradeLevel; label: string }[] = [
  { id: "FIRST", label: "1.°" },
  { id: "SECOND", label: "2.°" },
  { id: "THIRD", label: "3.°" },
  { id: "FOURTH", label: "4.°" },
  { id: "FIFTH", label: "5.°" },
];

const SECTIONS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const DURATIONS: { id: PedagogicalDuration; label: string }[] = [
  { id: "MINUTES_45", label: "45 min (1 h.p.)" },
  { id: "MINUTES_90", label: "90 min (2 h.p.)" },
  { id: "MINUTES_135", label: "135 min (3 h.p.)" },
];

export function Step1GeneralData({ form }: Step1Props) {
  const areas = useCurriculumAreas();
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;
  const currentArea = watch("areaId");
  const currentGrade = watch("gradeLevel");
  const currentSections = watch("sections") || [];
  const currentDuration = watch("pedagogicalDuration");
  const materials = watch("materialsAndResources") || [];

  const [newMaterial, setNewMaterial] = useState("");

  const toggleSection = (section: string) => {
    const updated = currentSections.includes(section)
      ? currentSections.filter((s) => s !== section)
      : [...currentSections, section];
    setValue("sections", updated, { shouldValidate: true });
  };

  const addMaterial = () => {
    if (newMaterial.trim()) {
      setValue("materialsAndResources", [...materials, newMaterial.trim()], {
        shouldValidate: true,
      });
      setNewMaterial("");
    }
  };

  const removeMaterial = (index: number) => {
    setValue(
      "materialsAndResources",
      materials.filter((_, idx) => idx !== index),
      { shouldValidate: true },
    );
  };

  return (
    <div className="space-y-5 rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between border-b pb-3">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
            1
          </span>
          Paso 1: Datos Generales de la Sesión
        </h3>
        <span className="text-xs font-medium text-slate-500">
          Estándares Ciclo VI y VII
        </span>
      </div>

      {/* Áreas Curriculares */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-700">
          Área Curricular Oficial (MINEDU):
        </label>
        {areas.isPending && <p role="status">Cargando áreas…</p>}
        {areas.isError && (
          <p role="alert">
            No se pudieron cargar las áreas.{" "}
            <button type="button" onClick={() => void areas.refetch()}>
              Reintentar
            </button>
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(areas.data ?? []).map(({ id, name }) => {
            const Icon = AREAS.find((area) => area.id === id)?.icon ?? BookOpen;
            const isSelected = currentArea === id;
            return (
              <button
                type="button"
                key={id}
                onClick={() => setValue("areaId", id, { shouldValidate: true })}
                className={`flex items-center gap-2 rounded-md border p-2 text-left text-xs transition-all ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${isSelected ? "text-emerald-600" : "text-slate-500"}`}
                />
                <span className="truncate">{name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grado y Duración */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700">
            Grado de Secundaria:
          </label>
          <div className="flex gap-1.5">
            {GRADES.map(({ id, label }) => (
              <button
                type="button"
                key={id}
                onClick={() =>
                  setValue("gradeLevel", id, { shouldValidate: true })
                }
                className={`flex-1 rounded border py-1.5 text-xs font-medium transition-all ${
                  currentGrade === id
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700">
            Duración Pedagógica:
          </label>
          <div className="flex gap-1.5">
            {DURATIONS.map(({ id, label }) => (
              <button
                type="button"
                key={id}
                onClick={() =>
                  setValue("pedagogicalDuration", id, { shouldValidate: true })
                }
                className={`flex-1 rounded border py-1.5 px-2 text-xs font-medium transition-all ${
                  currentDuration === id
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Secciones múltiples */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-700">
          Secciones (Selección múltiple):
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SECTIONS.map((sec) => {
            const isSelected = currentSections.includes(sec);
            return (
              <button
                type="button"
                key={sec}
                onClick={() => toggleSection(sec)}
                className={`h-7 w-7 rounded-full text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {sec}
              </button>
            );
          })}
        </div>
        {errors.sections && (
          <p className="text-xs text-rose-500">{errors.sections.message}</p>
        )}
      </div>

      {/* Unidad Didáctica */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-700">
          Unidad Didáctica o Eje Temático:
        </label>
        <Input
          {...register("unitTitle")}
          placeholder="Ej. Unidad 04: Comunicación asertiva y deliberación ciudadana"
        />
        {errors.unitTitle && (
          <p className="text-xs text-rose-500">{errors.unitTitle.message}</p>
        )}
      </div>

      {/* Materiales y Recursos editables */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-700">
          Materiales y Recursos Educativos:
        </label>
        <div className="flex gap-2">
          <Input
            value={newMaterial}
            onChange={(e) => setNewMaterial(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addMaterial();
              }
            }}
            placeholder="Agregar recurso (ej. Ficha de lectura, plumones)"
          />
          <button
            type="button"
            onClick={addMaterial}
            className="flex h-9 items-center justify-center rounded-md bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {materials.map((mat, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
            >
              {mat}
              <button
                type="button"
                onClick={() => removeMaterial(idx)}
                className="text-slate-400 hover:text-rose-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
