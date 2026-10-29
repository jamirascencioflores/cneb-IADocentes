import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionRepository } from "../infrastructure/http-session.repository";
import { SessionDraftFormData } from "../domain/session-form.schema";
import { SessionPreviewEntity } from "../domain/session.types";
import { ApiProblemException } from "@/shared/types/problem-details.types";
import { clearGenerationAttempt, getGenerationAttempt, isDefinitiveGenerationFailure } from "./pending-generation";

export const useSessionPreview = (userId: string) => {
  const queryClient = useQueryClient();
  return useMutation<
    SessionPreviewEntity,
    ApiProblemException,
    SessionDraftFormData
  >({
    mutationKey: ["sessions", "preview"],
    mutationFn: async (formData) => {
      const attempt = await getGenerationAttempt(userId, formData);
      try {
        const result = await sessionRepository.generatePreview(formData, attempt.idempotencyKey);
        clearGenerationAttempt(attempt);
        return result;
      } catch (error) {
        if (isDefinitiveGenerationFailure(error)) clearGenerationAttempt(attempt);
        throw error;
      }
    },
    onSuccess: () => {
      // A balance refresh must not turn a successful charged result into a rejected mutation.
      void queryClient.invalidateQueries({ queryKey: ["wallets", "me"] }).catch(() => undefined);
    },
  });
};
