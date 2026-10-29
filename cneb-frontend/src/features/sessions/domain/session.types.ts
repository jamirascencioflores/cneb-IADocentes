import { z } from "zod";

export const GradeLevelSchema = z.enum([
  "FIRST",
  "SECOND",
  "THIRD",
  "FOURTH",
  "FIFTH",
]);
export type GradeLevel = z.infer<typeof GradeLevelSchema>;

export const PedagogicalDurationSchema = z.enum([
  "MINUTES_45",
  "MINUTES_90",
  "MINUTES_135",
]);
export type PedagogicalDuration = z.infer<typeof PedagogicalDurationSchema>;

export const DidacticMomentTypeSchema = z.enum([
  "START",
  "DEVELOPMENT",
  "CLOSING",
]);
export type DidacticMomentType = z.infer<typeof DidacticMomentTypeSchema>;

export const InstrumentTypeSchema = z.enum([
  "CHECKLIST",
  "RUBRIC",
  "SELF_EVALUATION",
  "OBSERVATION_GUIDE",
  "NONE",
]);
export type InstrumentType = z.infer<typeof InstrumentTypeSchema>;

export const CrossCuttingThemeSchema = z.enum([
  "RIGHTS",
  "INCLUSIVE",
  "INTERCULTURAL",
  "GENDER_EQUALITY",
  "ENVIRONMENTAL",
  "COMMON_GOOD",
  "EXCELLENCE",
]);
export type CrossCuttingTheme = z.infer<typeof CrossCuttingThemeSchema>;

// Momentos didácticos retornados por la inferencia LLM
export const DidacticMomentItemSchema = z.object({
  momentType: DidacticMomentTypeSchema,
  allocatedMinutes: z.number().int().positive(),
  pedagogicalProcesses: z.string().min(1),
  activitiesDescription: z.string().min(1),
  duaNotes: z.string().nullable().optional(),
  orderIndex: z.number().int().nonnegative(),
});
export type DidacticMomentItem = z.infer<typeof DidacticMomentItemSchema>;

// Criterios de Evaluación observables
export const EvaluationCriterionItemSchema = z.object({
  criterionNumber: z.number().int().min(1).max(5),
  description: z.string().min(1),
});
export type EvaluationCriterionItem = z.infer<
  typeof EvaluationCriterionItemSchema
>;

// Entidad de previsualización de documento completo
export const SessionPreviewEntitySchema = z.object({
  id: z.string().uuid().optional(),
  institutionalProfile: z.object({
    teacherFullName: z.string(), specialty: z.string(), schoolName: z.string(),
    ugel: z.string(), dre: z.string(), principalName: z.string().nullable(),
    badgeUrl: z.string().nullable(), signatureUrl: z.string().nullable(),
  }).optional(),
  areaId: z.string().min(1),
  areaName: z.string().min(1),
  gradeLevel: GradeLevelSchema,
  sections: z.array(z.string().min(1)),
  pedagogicalDuration: PedagogicalDurationSchema,
  unitTitle: z.string().min(1),
  sessionTitle: z.string().min(1),
  learningPurpose: z.string().min(1),
  evidenceDescription: z.string().min(1),
  crossCuttingTheme: CrossCuttingThemeSchema,
  crossCuttingValues: z.string().min(1),
  hasDuaInclusion: z.boolean(),
  duaCategories: z.array(z.string()).default([]),
  materialsAndResources: z.array(z.string()),
  evaluationDeclaration: z.string().min(1),
  competencies: z.array(
    z.object({
      competencyId: z.string(),
      competencyTitle: z.string(),
      capacities: z.array(z.string()),
      performanceId: z.string(),
      precisedPerformance: z.string(),
      isPrimary: z.boolean(),
    }),
  ),
  didacticMoments: z.array(DidacticMomentItemSchema),
  instrument: z.object({
    instrumentType: InstrumentTypeSchema,
    evaluatedEvidence: z.string(),
    appendTableToDocument: z.boolean(),
    criteria: z.array(EvaluationCriterionItemSchema),
  }),
});
export type SessionPreviewEntity = z.infer<typeof SessionPreviewEntitySchema>;
