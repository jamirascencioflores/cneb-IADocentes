import type { GenerateSessionInput } from "../controllers/session.schemas.js";
export const authFixture = {
  sub: "00000000-0000-4000-8000-000000000001", sid: "00000000-0000-4000-8000-000000000002",
  role: "TEACHER" as const, email: "fixture@example.com", token_version: 0, must_change_password: false,
};
export const institutionalFixture = { teacherFullName: "Docente de prueba", specialty: "Comunicación",
  schoolName: "Escuela de prueba", ugel: "UGEL de prueba", dre: "DRE de prueba",
  principalName: null, badgeUrl: null, signatureUrl: null };
export const generationInput: GenerateSessionInput = {
  areaId: "COM", gradeLevel: "THIRD", sections: ["A"], pedagogicalDuration: "MINUTES_90",
  unitTitle: "Unidad de prueba", sessionTitle: "Sesión de prueba", crossCuttingTheme: "RIGHTS",
  crossCuttingValues: "Respeto", hasDuaInclusion: false, duaCategories: [], materialsAndResources: ["Papel"],
  selectedCompetencyIds: ["COM_C01"],
  selectedCompetencies: [{ competencyId: "COM_C01", performanceId: "PERF",
    precisedPerformance: "Desempeño precisado de prueba", isPrimary: true }],
  instrumentConfig: { instrumentType: "CHECKLIST", appendTableToDocument: true },
};
export const generationFixture = {
  learningPurpose: "Propósito de aprendizaje validado", evidenceDescription: "Evidencia de aprendizaje válida",
  crossCuttingValues: "Respeto", evaluationDeclaration: "Evaluación de la evidencia",
  moments: (["START", "DEVELOPMENT", "CLOSING"] as const).map((momentType, index) => ({
    momentType, allocatedMinutes: [15, 65, 10][index]!, pedagogicalProcesses: "Proceso de prueba",
    activitiesDescription: "Actividad de prueba", duaNotes: null,
  })),
  evaluationCriteria: ["Criterio 1", "Criterio 2", "Criterio 3", "Criterio 4", "Criterio 5"],
};
