import { z } from "zod";
import { DidacticMomentItemSchema } from "../domain/session.types";
import type { SessionDraftFormData } from "../domain/session-form.schema";

export type SessionPreviewRequestDTO = Omit<
  SessionDraftFormData,
  "selectedCompetencies" | "instrumentType" | "appendTableToDocument"
> & {
  selectedCompetencyIds: string[];
  instrumentConfig: Pick<
    SessionDraftFormData,
    "instrumentType" | "appendTableToDocument"
  >;
};

// Exact response of POST /sessions/preview. Form metadata stays with the request.
export const SessionPreviewResponseSchema = z
  .object({
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
