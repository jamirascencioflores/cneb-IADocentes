import { describe, it, expect } from "vitest";
import { SessionMapper } from "./session.mapper";
import { initialFormValues } from "../application/useSessionDraftForm";
import { generatedSession } from "@/test/session-preview.fixture";

describe("SessionMapper / backend contract", () => {
  it("sends competency IDs and instrument settings", () => {
    const dto = SessionMapper.toPreviewRequestDTO(initialFormValues);
    expect(dto.selectedCompetencyIds).toEqual(["COM_C01"]);
    expect(dto.instrumentConfig).toEqual({
      instrumentType: "CHECKLIST",
      appendTableToDocument: true,
    });
  });
  it("preserves the actual IA moments and form metadata through preview and save", () => {
    const form = {
      ...initialFormValues,
      areaId: "MAT",
      sessionTitle: "Cantidad y comercio",
    };
    const preview = SessionMapper.toDomainEntity(generatedSession, form);
    expect(preview.sessionTitle).toBe(form.sessionTitle);
    expect(preview.areaId).toBe("MAT");
    expect(preview.didacticMoments[0].activitiesDescription).toBe(
      generatedSession.moments[0].activitiesDescription,
    );
    expect(preview.instrument.criteria.map((c) => c.description)).toEqual(
      generatedSession.evaluationCriteria,
    );
    const saved = SessionMapper.toSaveSessionDTO(preview);
    expect(saved.moments).toEqual(
      generatedSession.moments.map((moment, index) => ({
        ...moment,
        orderIndex: index + 1,
      })),
    );
  });
  it("orders by moment type instead of provider array position", () => {
    const preview = SessionMapper.toDomainEntity(
      { ...generatedSession, moments: [...generatedSession.moments].reverse() },
      initialFormValues,
    );
    expect(preview.didacticMoments.map((m) => m.momentType)).toEqual([
      "START",
      "DEVELOPMENT",
      "CLOSING",
    ]);
  });
  it("rejects incomplete responses rather than inventing content", () => {
    expect(() =>
      SessionMapper.toDomainEntity(
        { ...generatedSession, moments: [] },
        initialFormValues,
      ),
    ).toThrow();
    expect(() =>
      SessionMapper.toDomainEntity(
        { ...generatedSession, evaluationCriteria: [] },
        initialFormValues,
      ),
    ).toThrow();
  });
  it("rejects a response for a different duration", () => {
    expect(() =>
      SessionMapper.toDomainEntity(generatedSession, {
        ...initialFormValues,
        pedagogicalDuration: "MINUTES_45",
      }),
    ).toThrow();
  });
});
