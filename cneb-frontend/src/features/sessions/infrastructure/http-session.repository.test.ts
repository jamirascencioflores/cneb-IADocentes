import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpSessionRepository } from "./http-session.repository";
import { httpClient } from "@/shared/lib/http-client";
import { initialFormValues } from "../application/useSessionDraftForm";
import { SessionPreviewResponseDTO } from "./session.dto";

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
    const mockApiResponse: SessionPreviewResponseDTO = {
      area_id: "COM",
      area_name: "Comunicación",
      grade_level: "THIRD",
      sections: ["A", "B"],
      pedagogical_duration: "MINUTES_90",
      unit_title: "Unidad 04",
      session_title: "El debate",
      learning_purpose: "Propósito",
      evidence_description: "Evidencia",
      cross_cutting_theme: "RIGHTS",
      cross_cutting_values: "Valores",
      has_dua_inclusion: true,
      dua_categories: [],
      materials_and_resources: ["Ficha"],
      evaluation_declaration: "Formativa",
      competencies: [],
      didactic_moments: [],
      instrument: {
        instrument_type: "CHECKLIST",
        evaluated_evidence: "Evidencia",
        append_table_to_document: true,
        criteria: [],
      },
    };

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
    expect(result.areaName).toBe("Comunicación");
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
