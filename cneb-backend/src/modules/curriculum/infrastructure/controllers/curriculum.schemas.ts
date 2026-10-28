import { z } from "zod";

export const curriculumTreeParamsSchema = z.object({
  areaId: z.string().min(2).max(20),
});

export const curriculumTreeQuerySchema = z.object({
  grade_level: z.enum(["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH"]),
});
