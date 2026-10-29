import { Kysely } from "kysely";
import { DatabaseSchema } from "../../../infrastructure/database/types.js";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "../../../core/errors/app-error.js";
import {
  IDocxGeneratorService,
  DocxSessionData,
} from "../domain/docx-generator.interface.js";
import { InstitutionalProfile } from "../../identity/domain/institutional-profile.entity.js";
import { institutionalSnapshotSchema } from "../../identity/domain/institutional-snapshot.js";

export interface ExportSessionDocxDTO {
  sessionId: string;
  userId: string;
}

export class ExportSessionDocxUseCase {
  constructor(
    private readonly docxGenerator: IDocxGeneratorService,
    private readonly db: Kysely<DatabaseSchema>,
  ) {}

  public async execute(
    dto: ExportSessionDocxDTO,
  ): Promise<{ fileBuffer: Buffer; fileName: string }> {
    // 1. Obtener sesión y validar propiedad (BOLA / IDOR)
    const session = await this.db
      .selectFrom("learning_sessions")
      .selectAll()
      .where("id", "=", dto.sessionId)
      .executeTakeFirst();

    if (!session) {
      throw new NotFoundError("Sesión de aprendizaje no encontrada.");
    }

    if (session.user_id !== dto.userId) {
      throw new ForbiddenError(
        "No tienes autorización para exportar esta sesión.",
      );
    }

    // 2. Obtener perfil institucional del docente
    const profileRow = await this.db
      .selectFrom("institutional_profiles")
      .selectAll()
      .where("user_id", "=", dto.userId)
      .executeTakeFirst();

    if (!profileRow || profileRow.user_id !== dto.userId) {
      throw new NotFoundError(
        "Tu cuenta debe ser configurada por el administrador con tus datos institucionales antes de exportar.",
      );
    }

    const snapshot = institutionalSnapshotSchema.safeParse(session.institutional_snapshot);
    if (!snapshot.success) throw new ConflictError(
      "La sesión histórica no tiene una copia institucional verificable. El administrador debe revisar su identidad original.",
    );
    const profile = InstitutionalProfile.reconstitute({
      ...snapshot.data,
      id: profileRow.id,
      userId: profileRow.user_id,
      isDefault: profileRow.is_default,
      createdAt: profileRow.created_at,
    });

    // 3. Consultar datos complementarios
    const [area, competencies, moments, instrument] = await Promise.all([
      this.db
        .selectFrom("areas")
        .select(["name"])
        .where("id", "=", session.area_id)
        .executeTakeFirst(),
      this.db
        .selectFrom("session_competencies as sc")
        .innerJoin("competencies as c", "c.id", "sc.competency_id")
        .select(["c.title", "sc.precised_performance"])
        .where("sc.session_id", "=", session.id)
        .execute(),
      this.db
        .selectFrom("session_moments")
        .selectAll()
        .where("session_id", "=", session.id)
        .orderBy("order_index", "asc")
        .execute(),
      this.db
        .selectFrom("evaluation_instruments")
        .selectAll()
        .where("session_id", "=", session.id)
        .executeTakeFirst(),
    ]);

    let criteria: string[] = [];
    if (instrument) {
      const criteriaRows = await this.db
        .selectFrom("evaluation_criteria")
        .selectAll()
        .where("instrument_id", "=", instrument.id)
        .orderBy("criterion_number", "asc")
        .execute();
      criteria = criteriaRows.map((c) => c.description);
    }

    const docxData: DocxSessionData = {
      sessionTitle: session.session_title,
      unitTitle: session.unit_title,
      areaName: area?.name ?? session.area_id,
      gradeLevel: session.grade_level,
      sections: formatSections(session.sections),
      pedagogicalDuration: session.pedagogical_duration,
      learningPurpose: session.learning_purpose,
      evidenceDescription: session.evidence_description,
      crossCuttingTheme: session.cross_cutting_theme,
      crossCuttingValues: session.cross_cutting_values,
      hasDuaInclusion: session.has_dua_inclusion,
      materialsAndResources: session.materials_and_resources,
      evaluationDeclaration: session.evaluation_declaration,
      competencies: competencies.map((c) => ({
        title: c.title,
        precisedPerformance: c.precised_performance,
      })),
      moments: moments.map((m) => ({
        momentType: m.moment_type,
        allocatedMinutes: m.allocated_minutes,
        pedagogicalProcesses: m.pedagogical_processes,
        activitiesDescription: m.activities_description,
        duaNotes: m.dua_notes,
      })),
      ...(criteria.length > 0 ? { evaluationCriteria: criteria } : {}),
      ...(instrument
        ? {
            instrumentType: instrument.instrument_type,
            appendTableToDocument: instrument.append_table_to_document,
          }
        : {}),
    };

    // 4. Compilación del Word en memoria
    const fileBuffer = await this.docxGenerator.compile(docxData, profile);

    const safeTitle = session.session_title
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);

    return {
      fileBuffer,
      fileName: `Sesion_${safeTitle}.docx`,
    };
  }
}

function formatSections(value: string): string {
  try {
    const sections: unknown = JSON.parse(value);
    if (Array.isArray(sections) && sections.every((s) => typeof s === "string"))
      return sections.join(", ");
  } catch {
    /* Older records may already contain display text. */
  }
  return value;
}
