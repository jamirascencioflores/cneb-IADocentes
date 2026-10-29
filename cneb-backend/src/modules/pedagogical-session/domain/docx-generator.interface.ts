import { InstitutionalProfile } from "../../identity/domain/institutional-profile.entity.js";

export interface DocxSessionData {
  unitTitle: string;
  sessionTitle: string;
  areaName: string;
  gradeLevel: string;
  sections: string;
  pedagogicalDuration: string;
  learningPurpose: string;
  evidenceDescription: string;
  crossCuttingTheme: string;
  crossCuttingValues: string;
  hasDuaInclusion: boolean;
  materialsAndResources: string[];
  evaluationDeclaration: string;
  competencies: Array<{
    title: string;
    precisedPerformance: string;
  }>;
  moments: Array<{
    momentType: "START" | "DEVELOPMENT" | "CLOSING";
    allocatedMinutes: number;
    pedagogicalProcesses: string;
    activitiesDescription: string;
    duaNotes?: string | null;
  }>;
  evaluationCriteria?: string[];
  instrumentType?:
    | "CHECKLIST"
    | "RUBRIC"
    | "SELF_EVALUATION"
    | "OBSERVATION_GUIDE"
    | "NONE";
  appendTableToDocument?: boolean;
}

export interface IDocxGeneratorService {
  compile(
    sessionData: DocxSessionData,
    profile: InstitutionalProfile,
  ): Promise<Buffer>;
}
