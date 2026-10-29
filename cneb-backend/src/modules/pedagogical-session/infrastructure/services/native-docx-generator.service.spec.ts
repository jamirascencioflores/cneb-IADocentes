import { it, expect } from "vitest";
import PizZip from "pizzip";
import { NativeDocxGeneratorService } from "./native-docx-generator.service.js";
import { InstitutionalProfile } from "../../../identity/domain/institutional-profile.entity.js";
import type { DocxSessionData } from "../../domain/docx-generator.interface.js";

const profile = InstitutionalProfile.create({
  userId: "user",
  teacherFullName: "Docente de prueba",
  specialty: "Comunicación",
  schoolName: "Escuela de prueba",
  ugel: "UGEL 01",
});
const data: DocxSessionData = {
  sessionTitle: "Sesión de prueba",
  unitTitle: "Unidad de prueba",
  areaName: "Comunicación",
  gradeLevel: "THIRD",
  sections: "A, B",
  pedagogicalDuration: "MINUTES_90",
  learningPurpose: "Propósito de prueba",
  evidenceDescription: "Evidencia de prueba",
  crossCuttingTheme: "RIGHTS",
  crossCuttingValues: "Respeto",
  hasDuaInclusion: false,
  materialsAndResources: ["Papel"],
  evaluationDeclaration: "Evaluación formativa",
  competencies: [],
  moments: [],
  evaluationCriteria: ["Criterio observable"],
  appendTableToDocument: true,
};
async function xml(overrides: Partial<DocxSessionData>) {
  const file = await new NativeDocxGeneratorService().compile(
    { ...data, ...overrides },
    profile,
  );
  return new PizZip(file).file("word/document.xml")!.asText();
}
it.each([
  ["CHECKLIST", "LISTA DE COTEJO", "SÍ"],
  ["RUBRIC", "RÚBRICA", "Logro esperado (A)"],
  ["SELF_EVALUATION", "AUTOEVALUACIÓN", "Necesito apoyo"],
  ["OBSERVATION_GUIDE", "GUÍA DE OBSERVACIÓN", "Evidencia observada"],
] as const)("exports %s with its own columns", async (type, title, column) => {
  const document = await xml({ instrumentType: type });
  expect(document).toContain(title);
  expect(document).toContain(column);
  expect(document).toContain("Criterio observable");
  if (type === "RUBRIC")
    expect(document).toContain("completa los descriptores");
});
it("omits the annex for NONE or when disabled", async () => {
  expect(await xml({ instrumentType: "NONE" })).not.toContain(
    "Criterio observable",
  );
  expect(
    await xml({ instrumentType: "CHECKLIST", appendTableToDocument: false }),
  ).not.toContain("Criterio observable");
});
