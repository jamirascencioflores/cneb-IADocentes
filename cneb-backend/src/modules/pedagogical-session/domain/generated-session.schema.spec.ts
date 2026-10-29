import { describe, it, expect } from "vitest";
import { generatedSessionSchemaFor } from "./generated-session.schema.js";
const payload = {
  learningPurpose: "Propósito pedagógico de prueba",
  evidenceDescription: "Evidencia de aprendizaje",
  crossCuttingValues: "Respeto",
  evaluationDeclaration: "Evaluación formativa de prueba",
  evaluationCriteria: ["Uno", "Dos", "Tres", "Cuatro", "Cinco"],
  moments: [
    {
      momentType: "START",
      allocatedMinutes: 10,
      pedagogicalProcesses: "Inicio",
      activitiesDescription: "Actividad inicial",
    },
    {
      momentType: "DEVELOPMENT",
      allocatedMinutes: 30,
      pedagogicalProcesses: "Desarrollo",
      activitiesDescription: "Actividad principal",
    },
    {
      momentType: "CLOSING",
      allocatedMinutes: 5,
      pedagogicalProcesses: "Cierre",
      activitiesDescription: "Reflexión",
    },
  ],
};
describe("generated session validation", () => {
  const schema = generatedSessionSchemaFor("MINUTES_45");
  it("accepts a complete valid response", () =>
    expect(schema.safeParse(payload).success).toBe(true));
  it("rejects malformed fields and criteria", () => {
    expect(schema.safeParse({ ...payload, learningPurpose: 12 }).success).toBe(
      false,
    );
    expect(
      schema.safeParse({ ...payload, evaluationCriteria: [1, 2, 3, 4, 5] })
        .success,
    ).toBe(false);
  });
  it("rejects duplicate moments and wrong totals", () => {
    expect(
      schema.safeParse({
        ...payload,
        moments: [payload.moments[0], payload.moments[0], payload.moments[2]],
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        ...payload,
        moments: payload.moments.map((m) => ({ ...m, allocatedMinutes: 15 })),
      }).success,
    ).toBe(false);
  });
});
