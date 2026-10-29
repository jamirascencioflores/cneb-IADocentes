import {
  ILLMService,
  GeneratedSessionPayload,
} from "../domain/llm-service.interface.js";
import { PedagogicalDurationType } from "../domain/pedagogical-duration.vo.js";
import { ICurriculumRepository } from "../../curriculum/domain/curriculum.repository.interface.js";
import {
  NotFoundError,
  ValidationError,
} from "../../../core/errors/app-error.js";

export interface PreviewSessionDTO {
  areaId: string;
  gradeLevel: string;
  sections: string[];
  pedagogicalDuration: PedagogicalDurationType;
  unitTitle: string;
  sessionTitle: string;
  crossCuttingTheme: string;
  hasDuaInclusion: boolean;
  selectedCompetencyIds: string[];
  materialsAndResources: string[];
  duaCategories?: string[];
}

export class PreviewSessionUseCase {
  constructor(
    private readonly llmService: ILLMService,
    private readonly curriculumRepository: ICurriculumRepository,
  ) {}

  public async execute(
    dto: PreviewSessionDTO,
  ): Promise<GeneratedSessionPayload> {
    const tree = await this.curriculumRepository.getCurriculumTree(
      dto.areaId,
      dto.gradeLevel,
    );
    if (!tree) {
      throw new NotFoundError(`Área curricular no encontrada: ${dto.areaId}`);
    }

    if (
      dto.selectedCompetencyIds.some(
        (id) => !tree.competencies.some((c) => c.id === id),
      )
    ) {
      throw new NotFoundError(
        "Alguna competencia seleccionada no pertenece al área.",
      );
    }
    if (
      tree.competencies.some(
        (c) =>
          dto.selectedCompetencyIds.includes(c.id) &&
          c.performances.length === 0,
      )
    ) {
      throw new ValidationError(
        "Faltan desempeños en el catálogo para el grado seleccionado.",
      );
    }
    const selectedCompetencies = tree.competencies
      .filter((c) => dto.selectedCompetencyIds.includes(c.id))
      .map((c) => ({
        title: c.title,
        standardDescription:
          c.performances[0]?.standardDescription ?? c.description,
      }));

    if (selectedCompetencies.length === 0) {
      throw new NotFoundError(
        "No se encontraron las competencias seleccionadas para este grado.",
      );
    }

    return this.llmService.generateSessionDraft({
      areaName: tree.areaName,
      gradeLevel: dto.gradeLevel,
      pedagogicalDuration: dto.pedagogicalDuration,
      unitTitle: dto.unitTitle,
      sessionTitle: dto.sessionTitle,
      crossCuttingTheme: dto.crossCuttingTheme,
      hasDuaInclusion: dto.hasDuaInclusion,
      selectedCompetencies,
      materialsAndResources: dto.materialsAndResources,
      duaCategories: dto.hasDuaInclusion ? (dto.duaCategories ?? []) : [],
    });
  }
}
