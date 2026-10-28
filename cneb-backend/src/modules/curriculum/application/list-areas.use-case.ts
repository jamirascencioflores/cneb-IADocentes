import { ICurriculumRepository } from "../domain/curriculum.repository.interface.js";

export class ListAreasUseCase {
  constructor(private readonly curriculumRepository: ICurriculumRepository) {}

  public async execute() {
    return this.curriculumRepository.listActiveAreas();
  }
}
