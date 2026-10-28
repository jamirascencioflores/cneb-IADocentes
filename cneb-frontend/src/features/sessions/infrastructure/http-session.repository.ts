import { httpClient } from "@/shared/lib/http-client";
import { ISessionRepository } from "../domain/session.repository";
import { SessionDraftFormData } from "../domain/session-form.schema";
import { SessionPreviewEntity } from "../domain/session.types";
import { SessionPreviewResponseDTO } from "./session.dto";
import { SessionMapper } from "./session.mapper";

export class HttpSessionRepository implements ISessionRepository {
  public async generatePreview(
    formData: SessionDraftFormData,
  ): Promise<SessionPreviewEntity> {
    const payload = SessionMapper.toPreviewRequestDTO(formData);
    const { data } = await httpClient.post<SessionPreviewResponseDTO>(
      "/sessions/preview",
      payload,
    );
    return SessionMapper.toDomainEntity(data);
  }

  public async saveSession(preview: SessionPreviewEntity): Promise<string> {
    const payload = SessionMapper.toSaveSessionDTO(preview);
    const { data } = await httpClient.post<{ id: string }>(
      "/sessions",
      payload,
    );
    return data.id;
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
