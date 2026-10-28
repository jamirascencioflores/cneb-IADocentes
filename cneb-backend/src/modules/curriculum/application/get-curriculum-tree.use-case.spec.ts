import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetCurriculumTreeUseCase } from "./get-curriculum-tree.use-case.js";
import {
  ICurriculumRepository,
  CurriculumTreeDTO,
} from "../domain/curriculum.repository.interface.js";
import { NotFoundError } from "../../../core/errors/app-error.js";

describe("GetCurriculumTreeUseCase", () => {
  let curriculumRepository: ICurriculumRepository;
  let useCase: GetCurriculumTreeUseCase;

  beforeEach(() => {
    curriculumRepository = {
      listActiveAreas: vi.fn(),
      getCurriculumTree: vi.fn(),
    };
    useCase = new GetCurriculumTreeUseCase(curriculumRepository);
  });

  it("debe retornar el árbol curricular estructurado cuando el área existe", async () => {
    const mockTree: CurriculumTreeDTO = {
      areaId: "COM",
      areaName: "Comunicación",
      gradeLevel: "THIRD",
      competencies: [
        {
          id: "COM-C1",
          title: "Se comunica oralmente en su lengua materna",
          description: "Descripción de la competencia",
          capacities: [
            {
              id: "CAP-1",
              title: "Obtiene información del texto oral",
              orderIndex: 1,
            },
          ],
          performances: [
            {
              id: "PERF-1",
              standardDescription:
                "Recupera información explícita de textos orales.",
            },
          ],
        },
      ],
    };

    vi.spyOn(curriculumRepository, "getCurriculumTree").mockResolvedValue(
      mockTree,
    );

    const result = await useCase.execute("COM", "THIRD");

    expect(result).toEqual(mockTree);
    expect(curriculumRepository.getCurriculumTree).toHaveBeenCalledWith(
      "COM",
      "THIRD",
    );
  });

  it("debe lanzar NotFoundError si el área no existe o está inactiva", async () => {
    vi.spyOn(curriculumRepository, "getCurriculumTree").mockResolvedValue(null);

    await expect(useCase.execute("INVALID_AREA", "THIRD")).rejects.toThrow(
      NotFoundError,
    );
  });
});
