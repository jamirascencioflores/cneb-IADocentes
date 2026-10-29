import { createHash, randomUUID } from "node:crypto";
import { sql, type Kysely, type Transaction } from "kysely";
import type { DatabaseSchema, InstitutionalSnapshot } from "../../../infrastructure/database/types.js";
import { ConflictError, ForbiddenError, NotFoundError, PaymentRequiredError, UnauthorizedError } from "../../../core/errors/app-error.js";
import type { TokenPayload } from "../../identity/infrastructure/security/token.service.js";
import { institutionalSnapshotSchema } from "../../identity/domain/institutional-snapshot.js";
import { CreditWallet } from "../../billing/domain/credit-wallet.entity.js";
import type { GenerateSessionInput } from "../controllers/session.schemas.js";
import { generatedSessionSchemaFor } from "../domain/generated-session.schema.js";
import type { GeneratedSessionPayload } from "../domain/llm-service.interface.js";
import { PreviewSessionUseCase } from "./preview-session.use-case.js";
import { SaveSessionUseCase } from "./save-session.use-case.js";

type Executor = Kysely<DatabaseSchema> | Transaction<DatabaseSchema>;
export interface GenerationResult extends GeneratedSessionPayload {
  id: string;
  institutionalProfile: InstitutionalSnapshot;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return "{" + Object.keys(object).sort().map((key) =>
      JSON.stringify(key) + ":" + canonical(object[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}
export class GenerateSessionUseCase {
  constructor(
    private readonly db: Kysely<DatabaseSchema>,
    private readonly preview: PreviewSessionUseCase,
    private readonly save = new SaveSessionUseCase(db),
  ) {}

  private async requirements(executor: Executor, auth: TokenPayload, lock: boolean) {
    let accountQuery = executor.selectFrom("users").selectAll().where("id", "=", auth.sub);
    if (lock) accountQuery = accountQuery.forUpdate();
    const user = await accountQuery.executeTakeFirst();
    if (!user?.is_active || user.token_version !== auth.token_version)
      throw new UnauthorizedError("Sesión inválida o cuenta desactivada.");
    if (user.role !== "TEACHER" || user.must_change_password)
      throw new ForbiddenError("Solo un docente habilitado puede generar sesiones.");
    let sessionQuery = executor.selectFrom("auth_sessions").selectAll()
      .where("id", "=", auth.sid).where("user_id", "=", auth.sub);
    if (lock) sessionQuery = sessionQuery.forUpdate();
    const session = await sessionQuery.executeTakeFirst();
    if (!session || session.revoked_at || session.expires_at <= new Date())
      throw new UnauthorizedError("Sesión revocada o expirada.");
    let profileQuery = executor.selectFrom("institutional_profiles").selectAll().where("user_id", "=", auth.sub);
    if (lock) profileQuery = profileQuery.forShare();
    const profile = await profileQuery.executeTakeFirst();
    if (!profile) throw new NotFoundError("Tu cuenta debe ser configurada por el administrador con tus datos institucionales.");
    const parsed = institutionalSnapshotSchema.safeParse({
      teacherFullName: profile.teacher_full_name, specialty: profile.specialty,
      schoolName: profile.school_name, ugel: profile.ugel, dre: profile.dre,
      principalName: profile.principal_name, badgeUrl: profile.badge_url, signatureUrl: profile.signature_url,
    });
    if (!parsed.success) throw new ConflictError("El administrador debe completar los datos institucionales de tu cuenta.");
    let walletQuery = executor.selectFrom("credit_wallets").selectAll().where("user_id", "=", auth.sub);
    if (lock) walletQuery = walletQuery.forUpdate();
    const row = await walletQuery.executeTakeFirst();
    if (!row) throw new NotFoundError("No se encontró la billetera del docente.");
    const wallet = CreditWallet.reconstitute({ id: row.id, userId: row.user_id,
      balance: row.balance, isUnlimited: row.is_unlimited, planType: row.plan_type,
      startsAt: row.starts_at, expiresAt: row.expires_at, createdAt: row.created_at, updatedAt: row.updated_at });
    if (!wallet.canGenerateSession()) throw new PaymentRequiredError("No tienes créditos de generación o tu plan no está vigente.");
    return { wallet, profile: parsed.data };
  }

  async execute(auth: TokenPayload, key: string, input: GenerateSessionInput): Promise<GenerationResult> {
    const hash = createHash("sha256").update(canonical(input)).digest("hex");
    const attemptId = randomUUID();
    const claim = await this.db.transaction().execute(async (trx) => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${auth.sub + ":" + key}, 0))`.execute(trx);
      const existing = await trx.selectFrom("generation_requests").selectAll()
        .where("user_id", "=", auth.sub).where("idempotency_key", "=", key).forUpdate().executeTakeFirst();
      if (existing) {
        if (existing.payload_hash !== hash) throw new ConflictError("Idempotency-Key ya utilizada con otro contenido.");
        if (existing.status === "COMPLETED") return { replay: existing.response as GenerationResult, id: existing.id };
        if (existing.status === "FAILED") throw new ConflictError("Esta generación falló sin cobro. Inicia otro intento con una clave nueva.");
        // No worker ever reclaims a key. A crashed attempt cannot race with a replacement.
        if (existing.lease_expires_at <= new Date()) {
          await trx.updateTable("generation_requests").set({ status: "FAILED", error_code: "INTERRUPTED", updated_at: new Date() })
            .where("id", "=", existing.id).execute();
          return { interrupted: true, id: existing.id };
        }
        throw new ConflictError("La generación sigue en progreso. Reintenta con la misma clave.");
      }
      await this.requirements(trx, auth, false);
      const id = randomUUID();
      await trx.insertInto("generation_requests").values({
        id, user_id: auth.sub, idempotency_key: key, payload_hash: hash,
        status: "PROCESSING", attempt_id: attemptId,
        lease_expires_at: new Date(Date.now() + 180000),
        session_id: null, response: null, error_code: null,
      }).execute();
      return { id };
    });
    if ("replay" in claim && claim.replay) return claim.replay;
    if ("interrupted" in claim) throw new ConflictError("La generación se interrumpió sin cobro. Usa una clave nueva.");
    try {
      const generated = generatedSessionSchemaFor(input.pedagogicalDuration)
        .parse(await this.preview.execute(input));
      const order = ["START", "DEVELOPMENT", "CLOSING"];
      generated.moments.sort((a, b) => order.indexOf(a.momentType) - order.indexOf(b.momentType));
      return await this.db.transaction().execute(async (trx) => {
        const request = await trx.selectFrom("generation_requests").selectAll()
          .where("id", "=", claim.id).forUpdate().executeTakeFirstOrThrow();
        if (request.status !== "PROCESSING" || request.attempt_id !== attemptId
          || request.lease_expires_at <= new Date())
          throw new ConflictError("El intento ya no está vigente; no se realizó ningún cobro.");
        const { wallet, profile } = await this.requirements(trx, auth, true);
        const before = wallet.balance;
        wallet.debitForSessionGeneration();
        const saved = await this.save.execute({
          ...input, userId: auth.sub, institutionalSnapshot: profile,
          ...generated, competencies: input.selectedCompetencies,
          moments: generated.moments.map((moment, index) => ({ ...moment, orderIndex: index + 1 })),
          instrument: {
            ...input.instrumentConfig, evaluatedEvidence: generated.evidenceDescription,
            criteria: generated.evaluationCriteria,
          },
        }, trx);
        if (!wallet.isUnlimited) {
          await trx.updateTable("credit_wallets").set({ balance: wallet.balance, updated_at: new Date() })
            .where("id", "=", wallet.id).execute();
          await trx.insertInto("wallet_transactions").values({
            id: randomUUID(), wallet_id: wallet.id, amount: -1,
            transaction_type: "SESSION_GENERATION_DEBIT", reference_session_id: saved.id,
            generation_request_id: claim.id, actor_user_id: null,
            balance_before: before, balance_after: wallet.balance,
            plan_type_before: wallet.planType, plan_type_after: wallet.planType,
            expires_at_before: wallet.expiresAt, expires_at_after: wallet.expiresAt,
            is_unlimited_before: false, is_unlimited_after: false,
            note: "Generación exitosa de sesión",
          }).execute();
        }
        const response: GenerationResult = { ...generated, id: saved.id, institutionalProfile: profile };
        await trx.updateTable("generation_requests").set({
          status: "COMPLETED", session_id: saved.id, response: JSON.stringify(response), updated_at: new Date(),
        }).where("id", "=", claim.id).execute();
        return response;
      });
    } catch (error) {
      // If COMMIT succeeded but its response was lost, this does not overwrite COMPLETED.
      await this.db.updateTable("generation_requests").set({
        status: "FAILED", error_code: "GENERATION_FAILED", updated_at: new Date(),
      }).where("id", "=", claim.id).where("attempt_id", "=", attemptId).where("status", "=", "PROCESSING")
        .execute().catch(() => undefined);
      throw error;
    }
  }
}
