import { Kysely } from "kysely";
import { DatabaseSchema } from "../../../infrastructure/database/types.js";
import {
  NotFoundError,
  ForbiddenError,
} from "../../../core/errors/app-error.js";
import { IWalletRepository } from "../../billing/domain/wallet.repository.interface.js";
import {
  IDocxGeneratorService,
  DocxSessionData,
} from "../domain/docx-generator.interface.js";
import { InstitutionalProfile } from "../../identity/domain/institutional-profile.entity.js";

export interface ExportSessionDocxDTO {
  sessionId: string;
  userId: string;
}

export class ExportSessionDocxUseCase {
  constructor(
    private readonly walletRepository: IWalletRepository,
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
      .where("is_default", "=", true)
      .executeTakeFirst();

    const profile = InstitutionalProfile.reconstitute({
      id: profileRow?.id ?? crypto.randomUUID(),
      userId: dto.userId,
      teacherFullName: profileRow?.teacher_full_name ?? "Docente CNEB",
      specialty: profileRow?.specialty ?? "Educación Secundaria",
      schoolName: profileRow?.school_name ?? "Institución Educativa",
      ugel: profileRow?.ugel ?? "UGEL",
      dre: profileRow?.dre ?? "DRELM",
      principalName: profileRow?.principal_name ?? null,
      badgeUrl: profileRow?.badge_url ?? null,
      signatureUrl: profileRow?.signature_url ?? null,
      isDefault: true,
      createdAt: new Date(),
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

    // 5. Transacción atómica de débito con bloqueo pesimista
    await this.db.transaction().execute(async (trx) => {
      const wallet = await this.walletRepository.findByUserIdForUpdate(
        dto.userId,
        trx,
      );
      if (!wallet) {
        throw new NotFoundError("No se encontró billetera de créditos activa.");
      }

      const hadCreditsBefore = wallet.balance;
      wallet.debitForSessionExport();
      await this.walletRepository.update(wallet, trx);

      if (!wallet.isUnlimited) {
        await this.walletRepository.recordTransaction(
          {
            walletId: wallet.id,
            amount: -1,
            transactionType: "SESSION_EXPORT_DEBIT",
            referenceSessionId: session.id,
            note: `Débito por exportación DOCX (Saldo: ${hadCreditsBefore} -> ${wallet.balance})`,
          },
          trx,
        );
      }
    });

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
