import { describe, it, expect, vi, beforeEach } from "vitest";
import { PreviewSessionUseCase } from "./preview-session.use-case.js";
import {
  ILLMService,
  GeneratedSessionPayload,
} from "../domain/llm-service.interface.js";
import {
  ICurriculumRepository,
  CurriculumTreeDTO,
} from "../../curriculum/domain/curriculum.repository.interface.js";
import { NotFoundError } from "../../../core/errors/app-error.js";

describe("PreviewSessionUseCase", () => {
  let llmService: ILLMService;
  let curriculumRepository: ICurriculumRepository;
  let useCase: PreviewSessionUseCase;

  const mockCurriculumTree: CurriculumTreeDTO = {
    areaId: "MAT",
    areaName: "Matemática",
    gradeLevel: "THIRD",
    competencies: [
      {
        id: "MAT-C1",
        title: "Resuelve problemas de cantidad",
        description: "Descripción general",
        capacities: [],
        performances: [
          {
            id: "PERF-MAT-1",
            standardDescription: "Traduce cantidades a expresiones numéricas.",
          },
        ],
      },
    ],
  };

  const mockPayload: GeneratedSessionPayload = {
    learningPurpose: "Aprender números racionales aplicados al comercio.",
    evidenceDescription:
      "Ficha de resolución de problemas con operaciones combinadas.",
    crossCuttingValues: "Justicia y solidaridad",
    evaluationDeclaration: "Evaluación formativa mediante lista de cotejo.",
    moments: [
      {
        momentType: "START",
        allocatedMinutes: 15,
        pedagogicalProcesses: "Motivación y saberes previos",
        activitiesDescription:
          "El docente presenta una situación problemática real.",
        duaNotes: null,
      },
      {
        momentType: "DEVELOPMENT",
        allocatedMinutes: 65,
        pedagogicalProcesses: "Gestión y acompañamiento",
        activitiesDescription:
          "Los estudiantes resuelven ejercicios en equipos [DUA — Principio de Representación].",
        duaNotes: null,
      },
      {
        momentType: "CLOSING",
        allocatedMinutes: 10,
        pedagogicalProcesses: "Evaluación y metacognición",
        activitiesDescription:
          "Reflexión individual sobre las estrategias empleadas.",
        duaNotes: null,
      },
    ],
    evaluationCriteria: [
      "Identifica datos en problemas de contexto real.",
      "Aplica operaciones con fracciones y decimales.",
      "Justifica los procedimientos utilizados.",
      "Comprueba los resultados obtenidos.",
      "Demuestra perseverancia en la resolución de problemas.",
    ],
  };

  beforeEach(() => {
    llmService = {
      generateSessionDraft: vi.fn(),
    };
    curriculumRepository = {
      listActiveAreas: vi.fn(),
      getCurriculumTree: vi.fn(),
    };
    useCase = new PreviewSessionUseCase(llmService, curriculumRepository);
  });

  it("debe orquestar la consulta del árbol y la generación con LLM exitosamente", async () => {
    vi.spyOn(curriculumRepository, "getCurriculumTree").mockResolvedValue(
      mockCurriculumTree,
    );
    vi.spyOn(llmService, "generateSessionDraft").mockResolvedValue(mockPayload);

    const result = await useCase.execute({
      areaId: "MAT",
      gradeLevel: "THIRD",
      sections: ["A", "B"],
      pedagogicalDuration: "MINUTES_90",
      unitTitle: "Unidad 1",
      sessionTitle: "Sesión sobre racionales",
      crossCuttingTheme: "COMMON_GOOD",
      hasDuaInclusion: true,
      selectedCompetencyIds: ["MAT-C1"],
      materialsAndResources: ["Plumones", "Ficha de trabajo"],
    });

    expect(result).toEqual(mockPayload);
    expect(curriculumRepository.getCurriculumTree).toHaveBeenCalledWith(
      "MAT",
      "THIRD",
    );
    expect(llmService.generateSessionDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        areaName: "Matemática",
        gradeLevel: "THIRD",
        pedagogicalDuration: "MINUTES_90",
        hasDuaInclusion: true,
        selectedCompetencies: [
          {
            title: "Resuelve problemas de cantidad",
            standardDescription: "Traduce cantidades a expresiones numéricas.",
          },
        ],
      }),
    );
  });

  it("debe arrojar NotFoundError si el área no existe en el catálogo", async () => {
    vi.spyOn(curriculumRepository, "getCurriculumTree").mockResolvedValue(null);

    await expect(
      useCase.execute({
        areaId: "NO_EXISTE",
        gradeLevel: "THIRD",
        sections: ["A"],
        pedagogicalDuration: "MINUTES_90",
        unitTitle: "U1",
        sessionTitle: "S1",
        crossCuttingTheme: "RIGHTS",
        hasDuaInclusion: false,
        selectedCompetencyIds: ["COMP-1"],
        materialsAndResources: ["Papel"],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("debe arrojar NotFoundError si ninguna de las competencias seleccionadas coincide", async () => {
    vi.spyOn(curriculumRepository, "getCurriculumTree").mockResolvedValue(
      mockCurriculumTree,
    );

    await expect(
      useCase.execute({
        areaId: "MAT",
        gradeLevel: "THIRD",
        sections: ["A"],
        pedagogicalDuration: "MINUTES_90",
        unitTitle: "U1",
        sessionTitle: "S1",
        crossCuttingTheme: "RIGHTS",
        hasDuaInclusion: false,
        selectedCompetencyIds: ["COMPETENCIA_INEXISTENTE"],
        materialsAndResources: ["Papel"],
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
