import type { SessionDraftFormData } from "../domain/session-form.schema";
import type { SessionPreviewEntity } from "../domain/session.types";
import {
  SessionPreviewResponseSchema,
  type SessionPreviewRequestDTO,
  type SessionPreviewResponseDTO,
} from "./session.dto";

export class SessionMapper {
  public static toPreviewRequestDTO(
    form: SessionDraftFormData,
  ): SessionPreviewRequestDTO {
    const {
      selectedCompetencies,
      instrumentType,
      appendTableToDocument,
      ...data
    } = form;
    return {
      ...data,
      selectedCompetencyIds: selectedCompetencies.map((c) => c.competencyId),
      selectedCompetencies,
      instrumentConfig: { instrumentType, appendTableToDocument },
    };
  }

  public static toDomainEntity(
    response: SessionPreviewResponseDTO,
    form: SessionDraftFormData,
  ): SessionPreviewEntity {
    const dto = SessionPreviewResponseSchema.parse(response);
    const order = ["START", "DEVELOPMENT", "CLOSING"];
    const expectedMinutes = {
      MINUTES_45: 45,
      MINUTES_90: 90,
      MINUTES_135: 135,
    }[form.pedagogicalDuration];
    if (
      dto.moments.reduce(
        (total, moment) => total + moment.allocatedMinutes,
        0,
      ) !== expectedMinutes
    ) {
      throw new Error(
        "Los minutos generados no corresponden a la duración seleccionada.",
      );
    }
    return {
      ...form,
      id: dto.id,
      institutionalProfile: dto.institutionalProfile,
      areaName: form.areaId,
      learningPurpose: dto.learningPurpose,
      evidenceDescription: dto.evidenceDescription,
      crossCuttingValues: dto.crossCuttingValues,
      evaluationDeclaration: dto.evaluationDeclaration,
      competencies: form.selectedCompetencies.map((c) => ({
        ...c,
        competencyTitle: c.competencyId,
        capacities: [],
      })),
      didacticMoments: [...dto.moments]
        .sort(
          (a, b) => order.indexOf(a.momentType) - order.indexOf(b.momentType),
        )
        .map((moment, index) => ({ ...moment, orderIndex: index + 1 })),
      instrument: {
        instrumentType: form.instrumentType,
        appendTableToDocument: form.appendTableToDocument,
        evaluatedEvidence: dto.evidenceDescription,
        criteria: dto.evaluationCriteria.map((description, index) => ({
          criterionNumber: index + 1,
          description,
        })),
      },
    };
  }

  public static toSaveSessionDTO(domain: SessionPreviewEntity) {
    return {
      areaId: domain.areaId,
      gradeLevel: domain.gradeLevel,
      sections: domain.sections,
      pedagogicalDuration: domain.pedagogicalDuration,
      unitTitle: domain.unitTitle,
      sessionTitle: domain.sessionTitle,
      learningPurpose: domain.learningPurpose,
      evidenceDescription: domain.evidenceDescription,
      crossCuttingTheme: domain.crossCuttingTheme,
      crossCuttingValues: domain.crossCuttingValues,
      hasDuaInclusion: domain.hasDuaInclusion,
      materialsAndResources: domain.materialsAndResources,
      evaluationDeclaration: domain.evaluationDeclaration,
      competencies: domain.competencies.map(
        ({ competencyId, performanceId, precisedPerformance, isPrimary }) => ({
          competencyId,
          performanceId,
          precisedPerformance,
          isPrimary,
        }),
      ),
      moments: domain.didacticMoments,
      instrument: {
        ...domain.instrument,
        criteria: domain.instrument.criteria.map((c) => c.description),
      },
    };
  }
}
