import type { Kysely, Transaction } from "kysely";
import type { DatabaseSchema } from "../../../infrastructure/database/types.js";
import { ForbiddenError, UnauthorizedError } from "../../../core/errors/app-error.js";
import type { AdminActor, AdminTransaction, IAdminAuditRepository, IAdminTeacherRepository,
  IAdminUnitOfWork, TeacherPublicData, InitialCreditMovement, AdminAuditEvent } from "../domain/admin.contracts.js";

class KyselyAdminTeacherRepository implements IAdminTeacherRepository {
  constructor(private readonly tx: Transaction<DatabaseSchema>) {}
  async insertUser(user: TeacherPublicData["user"], passwordHash: string) {
    await this.tx.insertInto("users").values({ id: user.id, email: user.email, password_hash: passwordHash,
      role: "TEACHER", is_active: true, must_change_password: true, token_version: 0 }).execute();
  }
  async insertProfile(profile: TeacherPublicData["profile"]) {
    await this.tx.insertInto("institutional_profiles").values({ id: profile.id, user_id: profile.userId,
      teacher_full_name: profile.teacherFullName, specialty: profile.specialty, school_name: profile.schoolName,
      ugel: profile.ugel, dre: profile.dre, principal_name: profile.principalName,
      badge_url: profile.badgeUrl, signature_url: profile.signatureUrl, is_default: true }).execute();
  }
  async insertWallet(wallet: TeacherPublicData["wallet"]) {
    await this.tx.insertInto("credit_wallets").values({ id: wallet.id, user_id: wallet.userId,
      balance: wallet.balance, plan_type: wallet.planType, is_unlimited: wallet.isUnlimited,
      expires_at: wallet.expiresAt === null ? null : new Date(wallet.expiresAt) }).execute();
  }
  async recordInitialCredits(movement: InitialCreditMovement) {
    const expiry = movement.expiresAt === null ? null : new Date(movement.expiresAt);
    await this.tx.insertInto("wallet_transactions").values({ id: movement.id, wallet_id: movement.walletId,
      amount: movement.amount, transaction_type: "ADMIN_MANUAL_ADJUSTMENT", actor_user_id: movement.actorUserId,
      balance_before: movement.balanceBefore, balance_after: movement.balanceAfter,
      plan_type_before: movement.planType, plan_type_after: movement.planType,
      is_unlimited_before: movement.isUnlimited, is_unlimited_after: movement.isUnlimited,
      expires_at_before: expiry, expires_at_after: expiry, note: movement.reason,
      reference_session_id: null, generation_request_id: null, admin_audit_event_id: movement.auditEventId }).execute();
  }
}
class KyselyAdminAuditRepository implements IAdminAuditRepository {
  constructor(private readonly tx: Transaction<DatabaseSchema>) {}
  async append(event: AdminAuditEvent) {
    await this.tx.insertInto("admin_audit_events").values({ id: event.id, actor_user_id: event.actorUserId,
      actor_role: event.actorRole, action: event.action, entity_type: event.entityType, entity_id: event.entityId,
      reason: event.reason, before_data: null, after_data: JSON.stringify(event.afterData), request_id: event.requestId }).execute();
  }
}
export class KyselyAdminUnitOfWork implements IAdminUnitOfWork {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}
  async execute<T>(operation: (transaction: AdminTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(async (tx) => operation({
      assertSuperadmin: (actor) => this.assertSuperadmin(tx, actor),
      teachers: new KyselyAdminTeacherRepository(tx), audit: new KyselyAdminAuditRepository(tx),
    }));
  }
  private async assertSuperadmin(tx: Transaction<DatabaseSchema>, actor: AdminActor) {
    const user = await tx.selectFrom("users").select(["role", "is_active", "token_version", "must_change_password"])
      .where("id", "=", actor.userId).forShare().executeTakeFirst();
    if (!user?.is_active || user.token_version !== actor.tokenVersion) throw new UnauthorizedError("Sesión inválida.");
    if (user.role !== "SUPERADMIN" || user.must_change_password) throw new ForbiddenError("Se requiere SUPERADMIN habilitado.");
    const session = await tx.selectFrom("auth_sessions").select(["revoked_at", "expires_at"])
      .where("id", "=", actor.sessionId).where("user_id", "=", actor.userId).forShare().executeTakeFirst();
    if (!session || session.revoked_at || session.expires_at <= new Date()) throw new UnauthorizedError("Sesión inválida.");
  }
}
