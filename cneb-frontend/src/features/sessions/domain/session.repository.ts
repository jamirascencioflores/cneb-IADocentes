import { SessionDraftFormData } from "./session-form.schema";
import { SessionPreviewEntity } from "./session.types";

export interface ISessionRepository {
  generatePreview(
    formData: SessionDraftFormData,
  ): Promise<SessionPreviewEntity>;
  saveSession(preview: SessionPreviewEntity): Promise<string>;
  downloadDocx(sessionId: string, fileName?: string): Promise<Blob>;
}
