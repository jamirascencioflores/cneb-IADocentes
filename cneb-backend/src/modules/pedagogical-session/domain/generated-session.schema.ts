import { z } from "zod";
import {
  PedagogicalDuration,
  type PedagogicalDurationType,
} from "./pedagogical-duration.vo.js";

export const sessionMomentSchema = z.object({
  momentType: z.enum(["START", "DEVELOPMENT", "CLOSING"]),
  allocatedMinutes: z.number().int().positive(),
  pedagogicalProcesses: z.string().trim().min(1),
  activitiesDescription: z.string().trim().min(1),
  duaNotes: z.string().nullable().optional(),
});

export function hasValidMoments(
  duration: PedagogicalDurationType,
  moments: z.infer<typeof sessionMomentSchema>[],
): boolean {
  const start = moments.find((m) => m.momentType === "START");
  const development = moments.find((m) => m.momentType === "DEVELOPMENT");
  const closing = moments.find((m) => m.momentType === "CLOSING");
  return (
    moments.length === 3 &&
    !!start &&
    !!development &&
    !!closing &&
    PedagogicalDuration.from(duration).validateDistribution(
      start.allocatedMinutes,
      development.allocatedMinutes,
      closing.allocatedMinutes,
    )
  );
}

export const generatedSessionSchema = z.object({
  learningPurpose: z.string().trim().min(10),
  evidenceDescription: z.string().trim().min(10),
  crossCuttingValues: z.string().trim().min(3),
  evaluationDeclaration: z.string().trim().min(10),
  moments: z.array(sessionMomentSchema).length(3),
  evaluationCriteria: z.array(z.string().trim().min(1)).length(5),
});

export function generatedSessionSchemaFor(duration: PedagogicalDurationType) {
  return generatedSessionSchema.refine(
    (data) => hasValidMoments(duration, data.moments),
    {
      path: ["moments"],
      message:
        "Los momentos deben ser únicos y respetar la distribución de la duración seleccionada.",
    },
  );
}
