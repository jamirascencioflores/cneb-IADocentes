import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateTeacherUseCase } from "./create-teacher.use-case.js";
import { TemporaryCredentialService } from "../../identity/application/temporary-credential.service.js";
import { adminContext, MemoryAdminUnitOfWork, teacherInput } from "./admin-test.fixture.js";
import { createTeacherSchema } from "../domain/admin.contracts.js";
import { ForbiddenError } from "../../../core/errors/app-error.js";

describe("administrative teacher creation (transaction double, no PostgreSQL)", () => {
  let work: MemoryAdminUnitOfWork;
  let create: CreateTeacherUseCase;
  const hash = { hash: vi.fn(async () => "$argon2id$test-hash"), compare: vi.fn() };
  beforeEach(() => { work = new MemoryAdminUnitOfWork(); hash.hash.mockClear(); create = new CreateTeacherUseCase(work, new TemporaryCredentialService(hash)); });
  it("commits exactly one user/profile/wallet and links the initial movement to safe audit", async () => {
    const result = await create.execute(teacherInput(), adminContext);
    expect(work.commits).toBe(1);
    expect([work.state.users.length, work.state.profiles.length, work.state.wallets.length]).toEqual([1, 1, 1]);
    expect(work.actor).toEqual(adminContext.actor);
    expect(work.state.users[0]).toMatchObject({ role: "TEACHER", isActive: true, mustChangePassword: true, passwordHash: "$argon2id$test-hash" });
    expect(result.temporaryPassword).toMatch(/^[\w-]{32}$/);
    expect(hash.hash).toHaveBeenCalledWith(result.temporaryPassword);
    expect(work.state.movements[0]).toMatchObject({ amount: 4, balanceBefore: 0, balanceAfter: 4, actorUserId: adminContext.actor.userId,
      reason: "Alta de prueba", auditEventId: work.state.audit[0]!.id });
    expect(work.state.audit[0]).toMatchObject({ actorRole: "SUPERADMIN", beforeData: null, afterData: {
      user: result.user, profile: result.profile, wallet: result.wallet }, requestId: "req-test" });
    const recorded = JSON.stringify({ audit: work.state.audit, movements: work.state.movements });
    expect(recorded).not.toContain(result.temporaryPassword);
    expect(recorded).not.toContain("$argon2");
    expect(recorded).not.toContain(adminContext.actor.sessionId);
    expect(JSON.stringify(result)).not.toMatch(/passwordHash|password_hash|token_version/);
  });
  it("preserves a supplied password verbatim and normalizes email before persistence", async () => {
    const input = { ...teacherInput(), email: "  Teacher@EXAMPLE.INVALID ", temporaryPassword: "  Supplied secret  " };
    const result = await create.execute(input, adminContext);
    expect(result.user.email).toBe("teacher@example.invalid");
    expect(result.temporaryPassword).toBe(input.temporaryPassword);
    expect(hash.hash).toHaveBeenCalledWith(input.temporaryPassword);
  });
  it("creates a coherent zero-credit lifetime account without a financial movement", async () => {
    const input = teacherInput(); input.initialCredits = 0;
    input.subscription = { planType: "LIFETIME_FREE", isUnlimited: true, expiresAt: null };
    expect((await create.execute(input, adminContext)).wallet).toMatchObject({ balance: 0, isUnlimited: true, expiresAt: null });
    expect(work.state.movements).toHaveLength(0); expect(work.state.audit).toHaveLength(1);
  });
  it("maps duplicate normalized email to 409 and preserves the original aggregate", async () => {
    await create.execute(teacherInput(), adminContext);
    const before = structuredClone(work.state);
    await expect(create.execute({ ...teacherInput(), email: "TEACHER@EXAMPLE.INVALID" }, adminContext)).rejects.toMatchObject({ statusCode: 409 });
    expect(work.state).toEqual(before); expect(work.rollbacks).toBe(1);
  });
  it.each(["user", "profile", "wallet", "audit", "movement", "commit"] as const)("rolls back all staged records on %s failure", async (failure) => {
    work.failure = failure;
    await expect(create.execute(teacherInput(), adminContext)).rejects.toThrow("simulated transaction failure");
    expect(work.state).toEqual({ users: [], profiles: [], wallets: [], movements: [], audit: [] });
    expect(work.commits).toBe(0); expect(work.rollbacks).toBe(1);
  });
  it("rechecks administrative authorization inside the transaction", async () => {
    work.authorizationError = new ForbiddenError("SUPERADMIN required");
    await expect(create.execute(teacherInput(), adminContext)).rejects.toMatchObject({ statusCode: 403 });
    expect(work.state.users).toHaveLength(0);
  });
  it("rejects a credential copied into the audit reason before writes", async () => {
    const input = { ...teacherInput(), temporaryPassword: "Never audit this password", reason: "Never audit this password" };
    await expect(create.execute(input, adminContext)).rejects.toMatchObject({ statusCode: 422 });
    expect(work.commits).toBe(0);
  });
  it.each(["TRIAL", "MONTHLY", "QUARTERLY", "ANNUAL"] as const)("requires expiry for %s", (planType) => {
    expect(createTeacherSchema.safeParse({ ...teacherInput(), subscription: { planType, isUnlimited: false, expiresAt: null } }).success).toBe(false);
    expect(createTeacherSchema.safeParse({ ...teacherInput(), subscription: { planType, isUnlimited: false, expiresAt: "2030-01-01T00:00:00Z" } }).success).toBe(true);
  });
  it.each(["BIMONTHLY", "TRIMONTHLY"])("rejects assigning %s", (planType) => {
    expect(createTeacherSchema.safeParse({ ...teacherInput(), subscription: { ...teacherInput().subscription, planType } }).success).toBe(false);
  });
  it.each([-1, 0.5, 2147483648, undefined])("rejects invalid/missing initial credits %s", (initialCredits) => {
    expect(createTeacherSchema.safeParse({ ...teacherInput(), initialCredits }).success).toBe(false);
  });
  it.each([0, 2147483647])("accepts the explicit initial-credit boundary %s", (initialCredits) => {
    expect(createTeacherSchema.safeParse({ ...teacherInput(), initialCredits }).success).toBe(true);
  });
  it.each(["a", "  ab  ", "a".repeat(256), "Bearer forbidden-token", "$argon2id$secret"])("rejects invalid reasons without echoing their content", (reason) => {
    expect(createTeacherSchema.safeParse({ ...teacherInput(), reason }).success).toBe(false);
  });
});
