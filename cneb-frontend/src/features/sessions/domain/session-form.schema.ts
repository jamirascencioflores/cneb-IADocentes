import { z } from "zod";
import {
  CrossCuttingThemeSchema,
  GradeLevelSchema,
  InstrumentTypeSchema,
  PedagogicalDurationSchema,
} from "./session.types";

export const SelectedCompetencyItemSchema = z.object({
  competencyId: z.string().min(1, "Debe seleccionar una competencia"),
  performanceId: z.string().min(1, "Debe seleccionar un desempeño"),
  precisedPerformance: z
    .string()
    .min(10, "El desempeño precisado es obligatorio"),
  isPrimary: z.boolean(),
});
export type SelectedCompetencyItem = z.infer<
  typeof SelectedCompetencyItemSchema
>;

export const SessionDraftFormSchema = z.object({
  // Paso 1: Datos Generales
  areaId: z.string().min(1, "Debe seleccionar un área curricular"),
  gradeLevel: GradeLevelSchema,
  sections: z.array(z.string()).min(1, "Seleccione al menos una sección"),
  pedagogicalDuration: PedagogicalDurationSchema,
  unitTitle: z
    .string()
    .min(3, "La unidad didáctica debe tener al menos 3 caracteres"),
  materialsAndResources: z
    .array(z.string())
    .min(1, "Ingrese al menos un recurso o material"),

  // Paso 2: Competencias CNEB
  selectedCompetencies: z
    .array(SelectedCompetencyItemSchema)
    .min(1, "Debe seleccionar al menos una competencia para la sesión"),
  crossCuttingTheme: CrossCuttingThemeSchema,
  crossCuttingValues: z
    .string()
    .min(3, "Especifique las actitudes o valores observables"),

  // Paso 3: Tema, DUA e Instrumento
  sessionTitle: z
    .string()
    .min(5, "El título de la sesión debe ser descriptivo"),
  hasDuaInclusion: z.boolean(),
  duaCategories: z.array(z.string()),
  instrumentType: InstrumentTypeSchema,
  appendTableToDocument: z.boolean(),
});

export type SessionDraftFormData = z.infer<typeof SessionDraftFormSchema>;
