import { z } from "zod";

export const updateInstitutionalProfileSchema = z.object({
  teacher_full_name: z
    .string()
    .trim()
    .min(3, "El nombre del docente es obligatorio")
    .max(150),
  specialty: z
    .string()
    .trim()
    .min(2, "La especialidad es obligatoria")
    .max(100),
  school_name: z
    .string()
    .trim()
    .min(3, "El nombre de la I.E. es obligatorio")
    .max(200),
  ugel: z.string().trim().min(2, "La UGEL es obligatoria").max(50),
  dre: z.string().trim().min(1).max(100).default("DRELM"),
  principal_name: z.string().max(150).nullable().optional(),
  badge_url: z.string().url().nullable().optional(),
  signature_url: z.string().url().nullable().optional(),
});

export type UpdateInstitutionalProfileDTO = z.infer<
  typeof updateInstitutionalProfileSchema
>;
