import { z } from "zod";

export const updateInstitutionalProfileSchema = z.object({
  teacher_full_name: z.string().min(3, "El nombre del docente es obligatorio"),
  specialty: z.string().min(2, "La especialidad es obligatoria"),
  school_name: z.string().min(3, "El nombre de la I.E. es obligatorio"),
  ugel: z.string().min(2, "La UGEL es obligatoria"),
  dre: z.string().default("DRELM"),
  principal_name: z.string().nullable().optional(),
  badge_url: z.string().url().nullable().optional(),
  signature_url: z.string().url().nullable().optional(),
});

export type UpdateInstitutionalProfileDTO = z.infer<
  typeof updateInstitutionalProfileSchema
>;
