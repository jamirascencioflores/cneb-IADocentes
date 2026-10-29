import { z } from "zod";

export const institutionalSnapshotSchema = z.object({
  teacherFullName: z.string().trim().min(1),
  specialty: z.string().trim().min(1),
  schoolName: z.string().trim().min(1),
  ugel: z.string().trim().min(1),
  dre: z.string().trim().min(1),
  principalName: z.string().nullable(),
  badgeUrl: z.string().nullable(),
  signatureUrl: z.string().nullable(),
}).strict();
