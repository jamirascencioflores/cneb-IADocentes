import { httpClient } from "@/shared/lib/http-client";
import { ISessionRepository } from "../domain/session.repository";
import { SessionDraftFormData } from "../domain/session-form.schema";
import { SessionPreviewEntity } from "../domain/session.types";
import { GenerationResponseSchema } from "./session.dto";
import { SessionMapper } from "./session.mapper";

export class HttpSessionRepository implements ISessionRepository {
  public async generatePreview(
    formData: SessionDraftFormData,
    idempotencyKey: string,
  ): Promise<SessionPreviewEntity> {
    const payload = SessionMapper.toPreviewRequestDTO(formData);
    const { data } = await httpClient.post(
      "/sessions/generate",
      payload,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return SessionMapper.toDomainEntity(GenerationResponseSchema.parse(data), formData);
  }

  public async downloadDocx(sessionId: string): Promise<Blob> {
    const response = await httpClient.get<Blob>(
      `/sessions/${sessionId}/export-docx`,
      {
        responseType: "blob",
        headers: {
          Accept:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      },
    );
    return response.data;
  }

  async exportDocx(sessionId: string): Promise<Blob> {
    const response = await httpClient.get<Blob>(
      `/sessions/${sessionId}/export-docx`,
      {
        responseType: "blob",
      },
    );
    return response.data;
  }
}

export const sessionRepository: ISessionRepository =
  new HttpSessionRepository();
