import { PedagogicalDurationType } from "./pedagogical-duration.vo.js";

export interface GenerateSessionPromptInput {
  areaName: string;
  gradeLevel: string;
  pedagogicalDuration: PedagogicalDurationType;
  unitTitle: string;
  sessionTitle: string;
  crossCuttingTheme: string;
  hasDuaInclusion: boolean;
  selectedCompetencies: Array<{
    title: string;
    standardDescription: string;
  }>;
}

export interface GeneratedSessionPayload {
  learningPurpose: string;
  evidenceDescription: string;
  crossCuttingValues: string;
  evaluationDeclaration: string;
  moments: Array<{
    momentType: "START" | "DEVELOPMENT" | "CLOSING";
    allocatedMinutes: number;
    pedagogicalProcesses: string;
    activitiesDescription: string;
    duaNotes?: string | null | undefined;
  }>;
  evaluationCriteria: string[]; // Exactamente 5 criterios observables
}

export interface ILLMService {
  generateSessionDraft(
    input: GenerateSessionPromptInput,
  ): Promise<GeneratedSessionPayload>;
}
