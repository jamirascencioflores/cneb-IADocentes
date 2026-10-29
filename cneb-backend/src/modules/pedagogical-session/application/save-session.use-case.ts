import crypto from "node:crypto";
import { ValidationError } from "../../../core/errors/app-error.js";
import { hasValidMoments } from "../domain/generated-session.schema.js";
import { Kysely, Transaction } from "kysely";
import {
  DatabaseSchema,
  GradeLevelEnum,
  PedagogicalDurationEnum,
  CrossCuttingThemeEnum,
  InstrumentTypeEnum,
  DidacticMomentTypeEnum,
  InstitutionalSnapshot,
} from "../../../infrastructure/database/types.js";

export interface SaveSessionDTO {
  userId: string;
  institutionalSnapshot?: InstitutionalSnapshot;
  areaId: string;
  gradeLevel: GradeLevelEnum;
  sections: string[];
  pedagogicalDuration: PedagogicalDurationEnum;
  unitTitle: string;
  sessionTitle: string;
  learningPurpose: string;
  evidenceDescription: string;
  crossCuttingTheme: CrossCuttingThemeEnum;
  crossCuttingValues: string;
  hasDuaInclusion: boolean;
  materialsAndResources: string[];
  evaluationDeclaration: string;
  competencies: Array<{
    competencyId: string;
    performanceId: string;
    precisedPerformance: string;
    isPrimary: boolean;
  }>;
  moments: Array<{
    momentType: DidacticMomentTypeEnum;
    allocatedMinutes: number;
    pedagogicalProcesses: string;
    activitiesDescription: string;
    duaNotes?: string | null | undefined;
    orderIndex: number;
  }>;
  instrument?:
    | {
        instrumentType: InstrumentTypeEnum;
        evaluatedEvidence: string;
        appendTableToDocument: boolean;
        criteria: string[];
      }
    | undefined;
}

export class SaveSessionUseCase {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  public async execute(dto: SaveSessionDTO, transaction?: Transaction<DatabaseSchema>): Promise<{ id: string }> {
    if (!hasValidMoments(dto.pedagogicalDuration, dto.moments)) {
      throw new ValidationError("Distribución temporal inválida.");
    }
    const sessionId = crypto.randomUUID();

    const persist = async (trx: Transaction<DatabaseSchema>) => {
      for (const competency of dto.competencies) {
        const match = await trx
          .selectFrom("performances as p")
          .innerJoin("competencies as c", "c.id", "p.competency_id")
          .innerJoin("areas as a", "a.id", "c.area_id")
          .select("p.id")
          .where("p.id", "=", competency.performanceId)
          .where("p.competency_id", "=", competency.competencyId)
          .where("p.grade_level", "=", dto.gradeLevel)
          .where("c.area_id", "=", dto.areaId)
          .where("a.is_active", "=", true)
          .executeTakeFirst();
        if (!match)
          throw new ValidationError(
            "El desempeño no corresponde al área, competencia y grado seleccionados.",
          );
      }
      await trx
        .insertInto("learning_sessions")
        .values({
          id: sessionId,
          user_id: dto.userId,
          institutional_snapshot: dto.institutionalSnapshot ? JSON.stringify(dto.institutionalSnapshot) : null,
          area_id: dto.areaId,
          grade_level: dto.gradeLevel,
          sections: JSON.stringify(dto.sections),
          pedagogical_duration: dto.pedagogicalDuration,
          unit_title: dto.unitTitle,
          session_title: dto.sessionTitle,
          learning_purpose: dto.learningPurpose,
          evidence_description: dto.evidenceDescription,
          cross_cutting_theme: dto.crossCuttingTheme,
          cross_cutting_values: dto.crossCuttingValues,
          has_dua_inclusion: dto.hasDuaInclusion,
          materials_and_resources: dto.materialsAndResources,
          evaluation_declaration: dto.evaluationDeclaration,
        })
        .execute();

      for (const comp of dto.competencies) {
        await trx
          .insertInto("session_competencies")
          .values({
            id: crypto.randomUUID(),
            session_id: sessionId,
            competency_id: comp.competencyId,
            performance_id: comp.performanceId,
            precised_performance: comp.precisedPerformance,
            is_primary: comp.isPrimary,
          })
          .execute();
      }

      for (const moment of dto.moments) {
        await trx
          .insertInto("session_moments")
          .values({
            id: crypto.randomUUID(),
            session_id: sessionId,
            moment_type: moment.momentType,
            allocated_minutes: moment.allocatedMinutes,
            pedagogical_processes: moment.pedagogicalProcesses,
            activities_description: moment.activitiesDescription,
            dua_notes: moment.duaNotes ?? null,
            order_index: moment.orderIndex,
          })
          .execute();
      }

      if (dto.instrument) {
        const instrumentId = crypto.randomUUID();
        await trx
          .insertInto("evaluation_instruments")
          .values({
            id: instrumentId,
            session_id: sessionId,
            instrument_type: dto.instrument.instrumentType,
            evaluated_evidence: dto.instrument.evaluatedEvidence,
            append_table_to_document: dto.instrument.appendTableToDocument,
          })
          .execute();

        for (let i = 0; i < dto.instrument.criteria.length; i++) {
          const criterionDescription = dto.instrument.criteria[i];
          if (criterionDescription) {
            await trx
              .insertInto("evaluation_criteria")
              .values({
                id: crypto.randomUUID(),
                instrument_id: instrumentId,
                criterion_number: i + 1,
                description: criterionDescription,
              })
              .execute();
          }
        }
      }
    };
    if (transaction) await persist(transaction);
    else await this.db.transaction().execute(persist);

    return { id: sessionId };
  }
}
