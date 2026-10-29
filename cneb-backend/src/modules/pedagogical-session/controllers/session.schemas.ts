import { z } from "zod";
import { hasValidMoments } from "../domain/generated-session.schema.js";

export const previewSessionSchema = z.object({
  duaCategories: z.array(z.string().max(200)).max(20).default([]),
  areaId: z.string().min(2),
  gradeLevel: z.enum(["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH"]),
  sections: z.array(z.string().min(1)).min(1),
  pedagogicalDuration: z.enum(["MINUTES_45", "MINUTES_90", "MINUTES_135"]),
  unitTitle: z.string().min(3).max(255),
  sessionTitle: z.string().min(3).max(255),
  crossCuttingTheme: z.enum([
    "RIGHTS",
    "INCLUSIVE",
    "INTERCULTURAL",
    "GENDER_EQUALITY",
    "ENVIRONMENTAL",
    "COMMON_GOOD",
    "EXCELLENCE",
  ]),
  hasDuaInclusion: z.boolean(),
  selectedCompetencyIds: z.array(z.string()).min(1),
  materialsAndResources: z.array(z.string()).min(1),
});

export const saveSessionSchema = z
  .object({
    areaId: z.string().min(2),
    gradeLevel: z.enum(["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH"]),
    sections: z.array(z.string().min(1)).min(1),
    pedagogicalDuration: z.enum(["MINUTES_45", "MINUTES_90", "MINUTES_135"]),
    unitTitle: z.string().min(3).max(255),
    sessionTitle: z.string().min(3).max(255),
    learningPurpose: z.string().min(10),
    evidenceDescription: z.string().min(10),
    crossCuttingTheme: z.enum([
      "RIGHTS",
      "INCLUSIVE",
      "INTERCULTURAL",
      "GENDER_EQUALITY",
      "ENVIRONMENTAL",
      "COMMON_GOOD",
      "EXCELLENCE",
    ]),
    crossCuttingValues: z.string().min(3),
    hasDuaInclusion: z.boolean(),
    materialsAndResources: z.array(z.string()).min(1),
    evaluationDeclaration: z.string().min(10),
    competencies: z
      .array(
        z.object({
          competencyId: z.string(),
          performanceId: z.string(),
          precisedPerformance: z.string(),
          isPrimary: z.boolean(),
        }),
      )
      .min(1),
    moments: z
      .array(
        z.object({
          momentType: z.enum(["START", "DEVELOPMENT", "CLOSING"]),
          allocatedMinutes: z.number().int().positive(),
          pedagogicalProcesses: z.string(),
          activitiesDescription: z.string(),
          duaNotes: z.string().nullable().optional(),
          orderIndex: z.number().int().nonnegative(),
        }),
      )
      .length(3),
    instrument: z
      .object({
        instrumentType: z.enum([
          "CHECKLIST",
          "RUBRIC",
          "SELF_EVALUATION",
          "OBSERVATION_GUIDE",
          "NONE",
        ]),
        evaluatedEvidence: z.string(),
        appendTableToDocument: z.boolean(),
        criteria: z.array(z.string()).length(5),
      })
      .optional(),
  })
  .refine((data) => hasValidMoments(data.pedagogicalDuration, data.moments), {
    path: ["moments"],
    message:
      "Los momentos y sus minutos no corresponden a la duración seleccionada.",
  })
  .refine(
    (data) =>
      new Set(data.competencies.map((c) => c.competencyId)).size ===
      data.competencies.length,
    {
      path: ["competencies"],
      message: "No se permiten competencias duplicadas.",
    },
  );

export const generateSessionSchema = previewSessionSchema.extend({
  crossCuttingValues: z.string().min(3),
  selectedCompetencies: z.array(z.object({
    competencyId: z.string().min(1),
    performanceId: z.string().min(1),
    precisedPerformance: z.string().min(10),
    isPrimary: z.boolean(),
  }).strict()).min(1),
  instrumentConfig: z.object({
    instrumentType: z.enum(["CHECKLIST", "RUBRIC", "SELF_EVALUATION", "OBSERVATION_GUIDE", "NONE"]),
    appendTableToDocument: z.boolean(),
  }).strict(),
}).strict().refine((data) => {
  const ids = data.selectedCompetencies.map((c) => c.competencyId);
  return new Set(ids).size === ids.length
    && ids.length === data.selectedCompetencyIds.length
    && ids.every((id) => data.selectedCompetencyIds.includes(id));
}, { message: "Las competencias seleccionadas deben coincidir y no repetirse." });
export type GenerateSessionInput = z.infer<typeof generateSessionSchema>;
