import { NotFoundError } from "../../../core/errors/app-error.js";
import { ICurriculumRepository } from "../domain/curriculum.repository.interface.js";

export class GetCurriculumTreeUseCase {
  constructor(private readonly curriculumRepository: ICurriculumRepository) {}

  public async execute(areaId: string, gradeLevel: string) {
    const tree = await this.curriculumRepository.getCurriculumTree(
      areaId,
      gradeLevel,
    );
    if (!tree) {
      throw new NotFoundError(`Área curricular no encontrada: ${areaId}`);
    }
    return tree;
  }
}
