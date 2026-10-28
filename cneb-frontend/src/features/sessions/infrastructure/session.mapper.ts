import { SessionDraftFormData } from "../domain/session-form.schema";
import { SessionPreviewEntity } from "../domain/session.types";
import {
  SessionPreviewRequestDTO,
  SessionPreviewResponseDTO,
  DidacticMomentDTO,
  CompetencyDTO,
  InstrumentCriteriaDTO,
} from "./session.dto";

interface ExtendedSessionPreviewResponseDTO extends SessionPreviewResponseDTO {
  evaluationCriteria?: string[];
}

interface RawInstrumentCriterionItem {
  criterionNumber?: number;
  criterion_number?: number;
  description?: string;
}

const DEFAULT_CRITERIA_FALLBACKS: readonly string[] = [
  "Adecúa su postura oral al propósito comunicativo y al auditorio.",
  "Sustenta argumentos sólidos contrastando información de fuentes confiables.",
  "Emplea recursos no verbales y modulación de voz para enfatizar sus ideas.",
  "Responde con réplicas asertivas y contraargumentos fundamentados ante objeciones.",
  "Mantiene una actitud de escucha activa y respeto a los turnos de deliberación.",
] as const;

export class SessionMapper {
  public static toPreviewRequestDTO(
    domain: SessionDraftFormData,
  ): SessionPreviewRequestDTO {
    return {
      areaId: domain.areaId,
      gradeLevel: domain.gradeLevel,
      sections: domain.sections,
      pedagogicalDuration: domain.pedagogicalDuration,
      unitTitle: domain.unitTitle,
      sessionTitle: domain.sessionTitle,
      crossCuttingTheme: domain.crossCuttingTheme,
      crossCuttingValues: domain.crossCuttingValues,
      hasDuaInclusion: domain.hasDuaInclusion,
      duaCategories: domain.duaCategories ?? [],
      materialsAndResources: domain.materialsAndResources,
      selectedCompetencyIds: domain.selectedCompetencies.map(
        (c) => c.competencyId,
      ),
      instrumentConfig: {
        instrumentType: domain.instrumentType,
        appendTableToDocument: domain.appendTableToDocument,
      },
    };
  }

  public static toDomainEntity(
    dto: ExtendedSessionPreviewResponseDTO,
  ): SessionPreviewEntity {
    const rawMoments: DidacticMomentDTO[] =
      dto.didacticMoments ?? dto.didactic_moments ?? [];
    const rawCompetencies: CompetencyDTO[] = dto.competencies ?? [];
    const rawInstrument = dto.instrument;

    let extractedCriteria: Array<{
      criterionNumber: number;
      description: string;
    }> = [];

    if (
      Array.isArray(dto.evaluationCriteria) &&
      dto.evaluationCriteria.length > 0
    ) {
      extractedCriteria = dto.evaluationCriteria.map((desc, idx) => ({
        criterionNumber: idx + 1,
        description: desc,
      }));
    } else if (rawInstrument?.criteria && rawInstrument.criteria.length > 0) {
      extractedCriteria = (
        rawInstrument.criteria as Array<
          string | RawInstrumentCriterionItem | InstrumentCriteriaDTO
        >
      ).map((item, idx) => {
        if (typeof item === "string") {
          return {
            criterionNumber: idx + 1,
            description: item,
          };
        }
        return {
          criterionNumber:
            item.criterionNumber ?? item.criterion_number ?? idx + 1,
          description: item.description ?? "",
        };
      });
    }

    if (extractedCriteria.length < 5) {
      extractedCriteria = DEFAULT_CRITERIA_FALLBACKS.map((text, idx) => ({
        criterionNumber: idx + 1,
        description: text,
      }));
    }

    return {
      id: dto.id,
      areaId: dto.areaId ?? dto.area_id ?? "COM",
      areaName: dto.areaName ?? dto.area_name ?? "Comunicación",
      gradeLevel: dto.gradeLevel ?? dto.grade_level ?? "THIRD",
      sections: dto.sections ?? ["A", "B"],
      pedagogicalDuration:
        dto.pedagogicalDuration ?? dto.pedagogical_duration ?? "MINUTES_90",
      unitTitle: dto.unitTitle ?? dto.unit_title ?? "",
      sessionTitle: dto.sessionTitle ?? dto.session_title ?? "",
      learningPurpose:
        dto.learningPurpose ?? dto.learning_purpose ?? "Propósito de la sesión",
      evidenceDescription:
        dto.evidenceDescription ??
        dto.evidence_description ??
        "Evidencia de aprendizaje",
      crossCuttingTheme:
        dto.crossCuttingTheme ?? dto.cross_cutting_theme ?? "RIGHTS",
      crossCuttingValues:
        dto.crossCuttingValues ?? dto.cross_cutting_values ?? "",
      hasDuaInclusion: dto.hasDuaInclusion ?? dto.has_dua_inclusion ?? true,
      duaCategories: dto.duaCategories ?? dto.dua_categories ?? [],
      materialsAndResources:
        dto.materialsAndResources ?? dto.materials_and_resources ?? [],
      evaluationDeclaration:
        dto.evaluationDeclaration ??
        dto.evaluation_declaration ??
        "Evaluación formativa",
      competencies: rawCompetencies.map((comp) => ({
        competencyId: comp.competencyId ?? comp.competency_id ?? "COM-01",
        competencyTitle:
          comp.competencyTitle ??
          comp.competency_title ??
          "Competencia oficial",
        capacities: comp.capacities ?? [],
        performanceId:
          comp.performanceId ?? comp.performance_id ?? "PERF-DEFAULT",
        precisedPerformance:
          comp.precisedPerformance ??
          comp.precised_performance ??
          "Desempeño precisado",
        isPrimary: comp.isPrimary ?? comp.is_primary ?? true,
      })),
      didacticMoments: [
        {
          momentType: "START" as const,
          allocatedMinutes:
            rawMoments[0]?.allocatedMinutes ??
            rawMoments[0]?.allocated_minutes ??
            15,
          pedagogicalProcesses:
            rawMoments[0]?.pedagogicalProcesses ??
            rawMoments[0]?.pedagogical_processes ??
            "Motivación, Saberes Previos y Propósito",
          activitiesDescription:
            rawMoments[0]?.activitiesDescription ??
            rawMoments[0]?.activities_description ??
            "El docente da la bienvenida y presenta la situación retadora.",
          duaNotes: rawMoments[0]?.duaNotes ?? rawMoments[0]?.dua_notes ?? null,
          orderIndex: 1,
        },
        {
          momentType: "DEVELOPMENT" as const,
          allocatedMinutes:
            rawMoments[1]?.allocatedMinutes ??
            rawMoments[1]?.allocated_minutes ??
            65,
          pedagogicalProcesses:
            rawMoments[1]?.pedagogicalProcesses ??
            rawMoments[1]?.pedagogical_processes ??
            "Gestión y Acompañamiento",
          activitiesDescription:
            rawMoments[1]?.activitiesDescription ??
            rawMoments[1]?.activities_description ??
            "Análisis de información y aplicación de estrategias en equipos.",
          duaNotes: rawMoments[1]?.duaNotes ?? rawMoments[1]?.dua_notes ?? null,
          orderIndex: 2,
        },
        {
          momentType: "CLOSING" as const,
          allocatedMinutes:
            rawMoments[2]?.allocatedMinutes ??
            rawMoments[2]?.allocated_minutes ??
            10,
          pedagogicalProcesses:
            rawMoments[2]?.pedagogicalProcesses ??
            rawMoments[2]?.pedagogical_processes ??
            "Metacognición y Evaluación",
          activitiesDescription:
            rawMoments[2]?.activitiesDescription ??
            rawMoments[2]?.activities_description ??
            "Reflexión colectiva y síntesis del aprendizaje logrado.",
          duaNotes: rawMoments[2]?.duaNotes ?? rawMoments[2]?.dua_notes ?? null,
          orderIndex: 3,
        },
      ].map((defaultMoment, idx) => {
        const raw = rawMoments[idx];
        if (!raw) return defaultMoment;
        return {
          momentType: defaultMoment.momentType,
          allocatedMinutes:
            raw.allocatedMinutes ??
            raw.allocated_minutes ??
            defaultMoment.allocatedMinutes,
          pedagogicalProcesses:
            raw.pedagogicalProcesses ??
            raw.pedagogical_processes ??
            defaultMoment.pedagogicalProcesses,
          activitiesDescription:
            raw.activitiesDescription ??
            raw.activities_description ??
            defaultMoment.activitiesDescription,
          duaNotes: raw.duaNotes ?? raw.dua_notes ?? defaultMoment.duaNotes,
          orderIndex: idx + 1,
        };
      }),
      instrument: {
        instrumentType:
          rawInstrument?.instrumentType ??
          rawInstrument?.instrument_type ??
          "CHECKLIST",
        evaluatedEvidence:
          rawInstrument?.evaluatedEvidence ??
          rawInstrument?.evaluated_evidence ??
          "Evidencia evaluada",
        appendTableToDocument:
          rawInstrument?.appendTableToDocument ??
          rawInstrument?.append_table_to_document ??
          true,
        criteria: extractedCriteria,
      },
    };
  }

  public static toSaveSessionDTO(domain: SessionPreviewEntity) {
    const rawCriteria: string[] = (domain.instrument?.criteria || []).map(
      (criterion: { description: string }) => criterion.description,
    );

    const guaranteed5Criteria: string[] =
      rawCriteria.length === 5
        ? rawCriteria
        : DEFAULT_CRITERIA_FALLBACKS.map(
            (fallback, idx) => rawCriteria[idx] || fallback,
          );

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
      duaCategories: domain.duaCategories ?? [],
      materialsAndResources: domain.materialsAndResources,
      evaluationDeclaration: domain.evaluationDeclaration,
      competencies: domain.competencies.map((c) => ({
        competencyId: c.competencyId,
        performanceId: c.performanceId,
        precisedPerformance: c.precisedPerformance,
        isPrimary: c.isPrimary,
      })),
      moments: domain.didacticMoments.map((m, idx) => ({
        momentType: m.momentType,
        allocatedMinutes: m.allocatedMinutes,
        pedagogicalProcesses: m.pedagogicalProcesses,
        activitiesDescription: m.activitiesDescription,
        duaNotes: m.duaNotes,
        orderIndex: m.orderIndex ?? idx + 1,
      })),
      instrument: {
        instrumentType: domain.instrument.instrumentType,
        evaluatedEvidence: domain.instrument.evaluatedEvidence,
        appendTableToDocument: domain.instrument.appendTableToDocument,
        criteria: guaranteed5Criteria,
      },
    };
  }
}
