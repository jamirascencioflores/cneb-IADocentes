import { useMutation } from "@tanstack/react-query";
import { sessionRepository } from "../infrastructure/http-session.repository";
import { SessionDraftFormData } from "../domain/session-form.schema";
import { SessionPreviewEntity } from "../domain/session.types";
import { ApiProblemException } from "@/shared/types/problem-details.types";

export const useSessionPreview = () => {
  return useMutation<
    SessionPreviewEntity,
    ApiProblemException,
    SessionDraftFormData
  >({
    mutationKey: ["sessions", "preview"],
    mutationFn: (formData: SessionDraftFormData) =>
      sessionRepository.generatePreview(formData),
  });
};
