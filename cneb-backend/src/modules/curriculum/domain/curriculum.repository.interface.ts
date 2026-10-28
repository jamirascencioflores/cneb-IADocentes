export interface AreaDTO {
  id: string;
  name: string;
  cycle: string;
}

export interface CapacityDTO {
  id: string;
  title: string;
  orderIndex: number;
}

export interface PerformanceDTO {
  id: string;
  standardDescription: string;
}

export interface CompetencyTreeDTO {
  id: string;
  title: string;
  description: string;
  capacities: CapacityDTO[];
  performances: PerformanceDTO[];
}

export interface CurriculumTreeDTO {
  areaId: string;
  areaName: string;
  gradeLevel: string;
  competencies: CompetencyTreeDTO[];
}

export interface ICurriculumRepository {
  listActiveAreas(): Promise<AreaDTO[]>;
  getCurriculumTree(
    areaId: string,
    gradeLevel: string,
  ): Promise<CurriculumTreeDTO | null>;
}
