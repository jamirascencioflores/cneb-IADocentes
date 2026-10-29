import { SessionDraftFormData } from "./session-form.schema";
import { SessionPreviewEntity } from "./session.types";

export interface ISessionRepository {
  generatePreview(
    formData: SessionDraftFormData,
    idempotencyKey: string,
  ): Promise<SessionPreviewEntity>;
  downloadDocx(sessionId: string, fileName?: string): Promise<Blob>;
}
