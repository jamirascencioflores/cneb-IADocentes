import { describe, it, expect } from "vitest";
import { SessionMapper } from "./session.mapper";
import { SessionDraftFormData } from "../domain/session-form.schema";
import { SessionPreviewResponseDTO } from "./session.dto";

describe("SessionMapper", () => {
  it("toPreviewRequestDTO debe transformar los campos de dominio a camelCase según el contrato API", () => {
    const formData: SessionDraftFormData = {
      areaId: "COM",
      gradeLevel: "THIRD",
      sections: ["A", "B"],
      pedagogicalDuration: "MINUTES_90",
      unitTitle: "Unidad 04: Comunicación",
      sessionTitle: "El debate argumentativo",
      crossCuttingTheme: "RIGHTS",
      crossCuttingValues: "Respeto a la libertad de expresión",
      hasDuaInclusion: true,
      duaCategories: ["Apoyos visuales"],
      materialsAndResources: ["Ficha de Trabajo"],
      selectedCompetencies: [
        {
          competencyId: "COM-01",
          performanceId: "PERF-01",
          precisedPerformance:
            "Adecúa el texto oral a la situación comunicativa.",
          isPrimary: true,
        },
      ],
      instrumentType: "CHECKLIST",
      appendTableToDocument: true,
    };

    const dto = SessionMapper.toPreviewRequestDTO(formData);

    expect(dto.areaId).toBe("COM");
    expect(dto.gradeLevel).toBe("THIRD");
    expect(dto.sections).toEqual(["A", "B"]);
    expect(dto.pedagogicalDuration).toBe("MINUTES_90");
    expect(dto.unitTitle).toBe("Unidad 04: Comunicación");
    expect(dto.sessionTitle).toBe("El debate argumentativo");
    expect(dto.crossCuttingTheme).toBe("RIGHTS");
    expect(dto.hasDuaInclusion).toBe(true);
    expect(dto.selectedCompetencyIds).toEqual(["COM-01"]);
    expect(dto.instrumentConfig?.instrumentType).toBe("CHECKLIST");
    expect(dto.instrumentConfig?.appendTableToDocument).toBe(true);
  });

  it("toDomainEntity debe transformar el payload del backend en entidad de UI estructurada", () => {
    const responseDto: SessionPreviewResponseDTO = {
      id: "b4550ef8-32a7-47b2-a63e-f1b212345678",
      areaId: "COM",
      areaName: "Comunicación",
      gradeLevel: "THIRD",
      sections: ["A", "B"],
      pedagogicalDuration: "MINUTES_90",
      unitTitle: "Unidad 04",
      sessionTitle: "El debate",
      learningPurpose: "Aprender a debatir con argumentos sólidos.",
      evidenceDescription: "Participación en el debate en aula.",
      crossCuttingTheme: "RIGHTS",
      crossCuttingValues: "Escucha activa",
      hasDuaInclusion: true,
      duaCategories: ["Apoyos visuales"],
      materialsAndResources: ["Ficha de Trabajo"],
      evaluationDeclaration: "Evaluación formativa",
      competencies: [
        {
          competencyId: "COM-01",
          competencyTitle: "Se comunica oralmente",
          capacities: ["Obtiene información"],
          performanceId: "PERF-01",
          precisedPerformance: "Adecúa el texto oral",
          isPrimary: true,
        },
      ],
      didacticMoments: [
        {
          momentType: "START",
          allocatedMinutes: 15,
          pedagogicalProcesses: "Motivación y saberes previos",
          activitiesDescription: "El docente presenta una situación retadora",
          duaNotes: "Apoyo visual",
          orderIndex: 1,
        },
      ],
      instrument: {
        instrumentType: "CHECKLIST",
        evaluatedEvidence: "Ficha de cotejo",
        appendTableToDocument: true,
        criteria: [
          {
            criterionNumber: 1,
            description: "Adecúa su postura con argumentos claros",
          },
        ],
      },
    };

    const entity = SessionMapper.toDomainEntity(responseDto);

    expect(entity.id).toBe("b4550ef8-32a7-47b2-a63e-f1b212345678");
    expect(entity.areaName).toBe("Comunicación");
    expect(entity.sessionTitle).toBe("El debate");
    expect(entity.didacticMoments[0].momentType).toBe("START");
    expect(entity.didacticMoments[0].allocatedMinutes).toBe(15);
    expect(entity.instrument.criteria).toHaveLength(1);
    expect(entity.instrument.criteria[0].criterionNumber).toBe(1);
  });
});
