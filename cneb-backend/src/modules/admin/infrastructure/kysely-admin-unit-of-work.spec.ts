import { describe, expect, it, vi } from "vitest";
import type { Kysely, Transaction } from "kysely";
import type { DatabaseSchema } from "../../../infrastructure/database/types.js";
import { KyselyAdminUnitOfWork } from "./kysely-admin-unit-of-work.js";
import { CreateTeacherUseCase } from "../application/create-teacher.use-case.js";
import { TemporaryCredentialService } from "../../identity/application/temporary-credential.service.js";
import { adminContext, teacherInput } from "../application/admin-test.fixture.js";

function adapterFixture(overrides: Record<string, unknown> = {}, sessionOverrides: Record<string, unknown> = {}) {
  const rows = { users: { role: "SUPERADMIN", is_active: true, token_version: 2, must_change_password: false, ...overrides },
    auth_sessions: { revoked_at: null, expires_at: new Date(Date.now() + 60000), ...sessionOverrides } };
  const writes: { table: string; values: unknown }[] = [];
  const reads = vi.fn((table: keyof typeof rows) => {
    const query = { select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), forShare: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn(async () => rows[table]) };
    return query;
  });
  const tx = { selectFrom: reads, insertInto: (table: string) => ({ values: (values: unknown) => ({ execute: async () => { writes.push({ table, values }); } }) }) };
  const execute = vi.fn(async (operation: (transaction: Transaction<DatabaseSchema>) => Promise<unknown>) => operation(tx as unknown as Transaction<DatabaseSchema>));
  const db = { transaction: () => ({ execute }) } as unknown as Kysely<DatabaseSchema>;
  return { work: new KyselyAdminUnitOfWork(db), execute, writes, reads };
}
describe("Kysely administrative adapter (query doubles only)", () => {
  it("uses a single transaction/executor for all writes and explicitly maps safe columns", async () => {
    const { work, execute, writes } = adapterFixture();
    const result = await new CreateTeacherUseCase(work, new TemporaryCredentialService({ hash: async () => "stored-hash", compare: async () => false }))
      .execute(teacherInput(), adminContext);
    expect(execute).toHaveBeenCalledOnce();
    expect(writes.map((row) => row.table)).toEqual(["users", "institutional_profiles", "credit_wallets", "admin_audit_events", "wallet_transactions"]);
    expect(writes[0]?.values).toMatchObject({ role: "TEACHER", password_hash: "stored-hash", must_change_password: true, token_version: 0 });
    expect(writes[4]?.values).toMatchObject({ transaction_type: "ADMIN_MANUAL_ADJUSTMENT", balance_before: 0, balance_after: 4 });
    expect(JSON.stringify(writes.slice(1))).not.toContain(result.temporaryPassword);
    expect(JSON.stringify(writes[3]?.values)).not.toContain("stored-hash");
  });
  it.each([
    [{ role: "TEACHER" }, {}, 403], [{ must_change_password: true }, {}, 403],
    [{ is_active: false }, {}, 401], [{ token_version: 1 }, {}, 401],
    [{}, { revoked_at: new Date() }, 401], [{}, { expires_at: new Date(0) }, 401],
  ] as const)("rechecks current account and session before writing %j %j", async (account, session, statusCode) => {
    const { work, writes } = adapterFixture(account, session);
    await expect(work.execute((tx) => tx.assertSuperadmin(adminContext.actor))).rejects.toMatchObject({ statusCode });
    expect(writes).toHaveLength(0);
  });
});
