import { z } from "zod";
import { DidacticMomentItemSchema } from "../domain/session.types";
import type { SessionDraftFormData } from "../domain/session-form.schema";

export type SessionPreviewRequestDTO = Omit<
  SessionDraftFormData,
  "selectedCompetencies" | "instrumentType" | "appendTableToDocument"
> & {
  selectedCompetencyIds: string[];
  selectedCompetencies: SessionDraftFormData["selectedCompetencies"];
  instrumentConfig: Pick<
    SessionDraftFormData,
    "instrumentType" | "appendTableToDocument"
  >;
};

export const InstitutionalSnapshotSchema = z.object({
  teacherFullName: z.string().min(1), specialty: z.string().min(1),
  schoolName: z.string().min(1), ugel: z.string().min(1), dre: z.string().min(1),
  principalName: z.string().nullable(), badgeUrl: z.string().nullable(), signatureUrl: z.string().nullable(),
});
// Shared generated content validation; the HTTP generation envelope also requires its persisted ID and identity.
export const SessionPreviewResponseSchema = z
  .object({
    id: z.string().uuid().optional(),
    institutionalProfile: InstitutionalSnapshotSchema.optional(),
    learningPurpose: z.string().min(10),
    evidenceDescription: z.string().min(10),
    crossCuttingValues: z.string().min(3),
    evaluationDeclaration: z.string().min(10),
    moments: z
      .array(DidacticMomentItemSchema.omit({ orderIndex: true }))
      .length(3),
    evaluationCriteria: z.array(z.string().min(1)).length(5),
  })
  .refine((data) => new Set(data.moments.map((m) => m.momentType)).size === 3, {
    path: ["moments"],
    message: "La respuesta contiene momentos duplicados.",
  });
export type SessionPreviewResponseDTO = z.infer<
  typeof SessionPreviewResponseSchema
>;
export const GenerationResponseSchema = SessionPreviewResponseSchema.safeExtend({
  id: z.string().uuid(),
  institutionalProfile: InstitutionalSnapshotSchema,
});
