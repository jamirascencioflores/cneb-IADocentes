import type { SessionPreviewResponseDTO } from "@/features/sessions/infrastructure/session.dto";
// Actual response shape returned by PreviewSessionUseCase (no form metadata).
export const generatedSession: SessionPreviewResponseDTO = {
  learningPurpose: "Resolver problemas de cantidad en equipos.",
  evidenceDescription: "Ficha de resolución de problemas contextualizados.",
  crossCuttingValues: "Respeto y solidaridad",
  evaluationDeclaration: "Evaluación formativa mediante criterios observables.",
  moments: [
    {
      momentType: "START",
      allocatedMinutes: 15,
      pedagogicalProcesses: "Motivación",
      activitiesDescription: "ACTIVIDAD ORIGINAL IA: analizar el problema.",
    },
    {
      momentType: "DEVELOPMENT",
      allocatedMinutes: 65,
      pedagogicalProcesses: "Acompañamiento",
      activitiesDescription: "Resolver y contrastar estrategias.",
      duaNotes: "Apoyos visuales",
    },
    {
      momentType: "CLOSING",
      allocatedMinutes: 10,
      pedagogicalProcesses: "Metacognición",
      activitiesDescription: "Explicar las estrategias utilizadas.",
    },
  ],
  evaluationCriteria: [
    "Identifica datos.",
    "Representa cantidades.",
    "Aplica estrategias.",
    "Justifica resultados.",
    "Comprueba su respuesta.",
  ],
};
