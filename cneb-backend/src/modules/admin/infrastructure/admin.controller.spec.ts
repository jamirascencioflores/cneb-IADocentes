import Fastify, { LogController } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../../infrastructure/database/database.js", () => ({ db: {} }));
vi.mock("../../identity/infrastructure/security/auth-session.instance.js", () => ({ authSessions: { validate: vi.fn() } }));
import { authSessions } from "../../identity/infrastructure/security/auth-session.instance.js";
import { Argon2HashService } from "../../identity/infrastructure/security/hash.service.js";
import { ForbiddenError, UnauthorizedError } from "../../../core/errors/app-error.js";
import { errorHandler } from "../../../presentation/middlewares/error-handler.js";
import { adminRoutes } from "./admin.controller.js";
import { KyselyAdminUnitOfWork } from "./kysely-admin-unit-of-work.js";
import { adminContext, MemoryAdminUnitOfWork, teacherInput } from "../application/admin-test.fixture.js";

const headers = { authorization: "Bearer PRIVATE_ACCESS_TOKEN", cookie: "refreshToken=PRIVATE_COOKIE" };
const claims = { sub: adminContext.actor.userId, sid: adminContext.actor.sessionId, token_version: 2,
  role: "SUPERADMIN" as const, email: "admin@example.invalid", must_change_password: false };
describe("POST /api/v1/admin/teachers (HTTP with no database)", () => {
  let app: ReturnType<typeof Fastify>;
  let work: MemoryAdminUnitOfWork;
  let logs: string;
  beforeEach(async () => {
    logs = ""; work = new MemoryAdminUnitOfWork();
    vi.mocked(authSessions.validate).mockResolvedValue({ ...claims });
    vi.spyOn(KyselyAdminUnitOfWork.prototype, "execute").mockImplementation((operation) => work.execute(operation));
    vi.spyOn(Argon2HashService.prototype, "hash").mockResolvedValue("$argon2id$PRIVATE_HASH");
    app = Fastify({ logger: { level: "debug", stream: { write: (chunk: string) => { logs += chunk; } } },
      logController: new LogController({ disableRequestLogging: true }) });
    app.setErrorHandler(errorHandler);
    await app.register(adminRoutes, { prefix: "/api/v1/admin" });
  });
  afterEach(async () => { await app.close(); vi.restoreAllMocks(); });
  const post = (app: ReturnType<typeof Fastify>, payload: unknown = teacherInput()) =>
    app.inject({ method: "POST", url: "/api/v1/admin/teachers", headers, payload: payload as Record<string, unknown> });
  it("authorizes SUPERADMIN, returns 201/no-store and exposes only the one-time plaintext credential", async () => {
    const response = await post(app);
    expect(response.statusCode).toBe(201); expect(response.headers["cache-control"]).toBe("no-store");
    const body = response.json();
    expect(body.temporaryPassword).toHaveLength(32);
    expect(body.user).toMatchObject({ role: "TEACHER", mustChangePassword: true });
    expect(body.wallet.balance).toBe(4);
    expect(response.body).not.toContain("PRIVATE_HASH");
    expect(work.actor).toEqual(adminContext.actor);
    expect(JSON.stringify(work.state.audit)).not.toContain(body.temporaryPassword);
    expect(logs).not.toContain(body.temporaryPassword);
    expect(logs).not.toMatch(/PRIVATE_ACCESS_TOKEN|PRIVATE_COOKIE|PRIVATE_HASH/);
  });
  it("returns a supplied password unchanged and trims the reason", async () => {
    const response = await post(app, { ...teacherInput(), temporaryPassword: "  Supplied password  ", reason: "  Alta revisada  " });
    expect(response.statusCode).toBe(201);
    expect(response.json().temporaryPassword).toBe("  Supplied password  ");
    expect(work.state.audit[0]?.reason).toBe("Alta revisada");
    expect(logs).not.toContain("Supplied password");
  });
  it("rejects TEACHER before body validation and before creating credentials", async () => {
    vi.mocked(authSessions.validate).mockResolvedValue({ ...claims, role: "TEACHER" });
    expect((await post(app, {})).statusCode).toBe(403);
    expect(Argon2HashService.prototype.hash).not.toHaveBeenCalled();
    expect(work.commits).toBe(0);
  });
  it("rejects missing credentials", async () => {
    expect((await app.inject({ method: "POST", url: "/api/v1/admin/teachers", payload: teacherInput() })).statusCode).toBe(401);
  });
  it("rejects stale, inactive or revoked authentication and a SUPERADMIN requiring password change", async () => {
    vi.mocked(authSessions.validate).mockRejectedValue(new UnauthorizedError("Invalid session"));
    expect((await post(app)).statusCode).toBe(401);
    vi.mocked(authSessions.validate).mockResolvedValue({ ...claims, must_change_password: true });
    expect((await post(app)).statusCode).toBe(403);
    expect(work.commits).toBe(0);
  });
  it("rejects authorization lost between the guard and transaction", async () => {
    work.authorizationError = new ForbiddenError("Role changed");
    expect((await post(app)).statusCode).toBe(403); expect(work.state.users).toHaveLength(0);
  });
  it("normalizes email and returns sanitized 409 for an existing account", async () => {
    expect((await post(app)).statusCode).toBe(201);
    const response = await post(app, { ...teacherInput(), email: "  TEACHER@EXAMPLE.INVALID " });
    expect(response.statusCode).toBe(409);
    expect(response.body).not.toMatch(/unsafe database|PRIVATE_HASH|temporaryPassword/);
    expect(work.state.users).toHaveLength(1);
  });
  it.each(["BIMONTHLY", "TRIMONTHLY"])("rejects historical plan assignment %s", async (planType) => {
    expect((await post(app, { ...teacherInput(), subscription: { ...teacherInput().subscription, planType } })).statusCode).toBe(400);
  });
  it.each([
    { planType: "MONTHLY", isUnlimited: false, expiresAt: null },
    { planType: "LIFETIME_FREE", isUnlimited: false, expiresAt: null },
    { planType: "LIFETIME_FREE", isUnlimited: true, expiresAt: "2030-01-01T00:00:00Z" },
    { planType: "ANNUAL", isUnlimited: true, expiresAt: "2030-01-01T00:00:00Z" },
  ])("rejects an incoherent plan %j", async (subscription) => {
    expect((await post(app, { ...teacherInput(), subscription })).statusCode).toBe(400);
  });
  it("accepts coherent LIFETIME_FREE", async () => {
    const response = await post(app, { ...teacherInput(), initialCredits: 0,
      subscription: { planType: "LIFETIME_FREE", isUnlimited: true, expiresAt: null } });
    expect(response.statusCode).toBe(201); expect(work.state.movements).toHaveLength(0);
  });
  it.each(["short", "a".repeat(257)])("rejects invalid passwords without exposing the input", async (temporaryPassword) => {
    const response = await post(app, { ...teacherInput(), temporaryPassword });
    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain(temporaryPassword); expect(logs).not.toContain(temporaryPassword);
  });
  it.each(["role", "userId", "balance", "password_hash", "token_version"])("rejects client authority field %s", async (field) => {
    const response = await post(app, { ...teacherInput(), [field]: "PRIVATE_INPUT_SECRET" });
    expect(response.statusCode).toBe(400); expect(response.body).not.toContain("PRIVATE_INPUT_SECRET");
  });
  it("sanitizes database errors, rollback and logs including URL query values", async () => {
    vi.mocked(KyselyAdminUnitOfWork.prototype.execute).mockRejectedValue(Object.assign(
      new Error("PRIVATE_PASSWORD PRIVATE_HASH postgres://PRIVATE_DATABASE"),
      { detail: "failing row PRIVATE_PASSWORD", query: "INSERT PRIVATE_PASSWORD", parameters: ["PRIVATE_PASSWORD"] }));
    const response = await app.inject({ method: "POST", url: "/api/v1/admin/teachers?password=PRIVATE_QUERY", headers,
      payload: { ...teacherInput(), temporaryPassword: "PRIVATE_PASSWORD" } });
    expect(response.statusCode).toBe(500); expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json().instance).toBe("/api/v1/admin/teachers");
    expect(response.body + logs).not.toMatch(/PRIVATE_PASSWORD|PRIVATE_HASH|PRIVATE_DATABASE|PRIVATE_QUERY|PRIVATE_ACCESS_TOKEN|PRIVATE_COOKIE/);
    expect(logs).toContain("request_failed");
  });
  it("returns no credential or partial records when audit fails", async () => {
    work.failure = "audit";
    const response = await post(app, { ...teacherInput(), temporaryPassword: "PRIVATE_PASSWORD" });
    expect(response.statusCode).toBe(500);
    expect(response.body + logs).not.toContain("PRIVATE_PASSWORD");
    expect(work.state.users).toHaveLength(0); expect(work.rollbacks).toBe(1);
  });
});
