import {
  CrossCuttingTheme,
  DidacticMomentType,
  GradeLevel,
  InstrumentType,
  PedagogicalDuration,
} from "../domain/session.types";

export interface SessionPreviewRequestDTO {
  areaId: string;
  gradeLevel: GradeLevel;
  sections: string[];
  pedagogicalDuration: PedagogicalDuration;
  unitTitle: string;
  sessionTitle: string;
  crossCuttingTheme: CrossCuttingTheme;
  crossCuttingValues?: string;
  hasDuaInclusion: boolean;
  selectedCompetencyIds: string[];
  materialsAndResources: string[];
  duaCategories?: string[];
  instrumentConfig?: {
    instrumentType: InstrumentType;
    appendTableToDocument: boolean;
  };
}

export interface DidacticMomentDTO {
  momentType?: DidacticMomentType;
  moment_type?: DidacticMomentType;
  allocatedMinutes?: number;
  allocated_minutes?: number;
  pedagogicalProcesses?: string;
  pedagogical_processes?: string;
  activitiesDescription?: string;
  activities_description?: string;
  duaNotes?: string | null;
  dua_notes?: string | null;
  orderIndex?: number;
  order_index?: number;
}

export interface CompetencyDTO {
  competencyId?: string;
  competency_id?: string;
  competencyTitle?: string;
  competency_title?: string;
  capacities?: string[];
  performanceId?: string;
  performance_id?: string;
  precisedPerformance?: string;
  precised_performance?: string;
  isPrimary?: boolean;
  is_primary?: boolean;
}

export interface InstrumentCriteriaDTO {
  criterionNumber?: number;
  criterion_number?: number;
  description: string;
}

export interface InstrumentDTO {
  instrumentType?: InstrumentType;
  instrument_type?: InstrumentType;
  evaluatedEvidence?: string;
  evaluated_evidence?: string;
  appendTableToDocument?: boolean;
  append_table_to_document?: boolean;
  criteria?: InstrumentCriteriaDTO[];
}

export interface SessionPreviewResponseDTO {
  id?: string;
  areaId?: string;
  area_id?: string;
  areaName?: string;
  area_name?: string;
  gradeLevel?: GradeLevel;
  grade_level?: GradeLevel;
  sections?: string[];
  pedagogicalDuration?: PedagogicalDuration;
  pedagogical_duration?: PedagogicalDuration;
  unitTitle?: string;
  unit_title?: string;
  sessionTitle?: string;
  session_title?: string;
  learningPurpose?: string;
  learning_purpose?: string;
  evidenceDescription?: string;
  evidence_description?: string;
  crossCuttingTheme?: CrossCuttingTheme;
  cross_cutting_theme?: CrossCuttingTheme;
  crossCuttingValues?: string;
  cross_cutting_values?: string;
  hasDuaInclusion?: boolean;
  has_dua_inclusion?: boolean;
  duaCategories?: string[];
  dua_categories?: string[];
  materialsAndResources?: string[];
  materials_and_resources?: string[];
  evaluationDeclaration?: string;
  evaluation_declaration?: string;
  competencies?: CompetencyDTO[];
  didacticMoments?: DidacticMomentDTO[];
  didactic_moments?: DidacticMomentDTO[];
  instrument?: InstrumentDTO;
}
