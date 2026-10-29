import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpSessionRepository } from "./http-session.repository";
import { httpClient } from "@/shared/lib/http-client";
import { initialFormValues } from "../application/useSessionDraftForm";
import { generatedSession } from "@/test/session-preview.fixture";

vi.mock("@/shared/lib/http-client", () => ({
  httpClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe("HttpSessionRepository", () => {
  let repository: HttpSessionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new HttpSessionRepository();
  });

  it("generatePreview debe invocar /sessions/preview con el payload transformado", async () => {
    const mockApiResponse = generatedSession;

    vi.mocked(httpClient.post).mockResolvedValueOnce({ data: mockApiResponse });

    const result = await repository.generatePreview(initialFormValues);

    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith(
      "/sessions/preview",
      expect.objectContaining({
        areaId: "COM",
        gradeLevel: "THIRD",
      }),
    );
    expect(result.areaId).toBe("COM");
    expect(result.didacticMoments[0].activitiesDescription).toBe(
      generatedSession.moments[0].activitiesDescription,
    );
  });

  it("downloadDocx debe llamar a /sessions/:id/export-docx solicitando responseType blob", async () => {
    const mockBlob = new Blob(["fake-docx-content"], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    vi.mocked(httpClient.get).mockResolvedValueOnce({ data: mockBlob });

    const blob = await repository.downloadDocx("session-uuid-123");

    expect(httpClient.get).toHaveBeenCalledWith(
      "/sessions/session-uuid-123/export-docx",
      expect.objectContaining({ responseType: "blob" }),
    );
    expect(blob).toBeInstanceOf(Blob);
  });
});
