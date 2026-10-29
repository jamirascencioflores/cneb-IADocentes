import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("../config/env.js", () => ({ env: {
  NODE_ENV: "test", DATABASE_URL: "postgres://test:test@localhost:5432/test", DATABASE_MAX_CONNECTIONS: 1,
  JWT_ACCESS_SECRET: "test-access-secret-at-least-32-characters",
  JWT_REFRESH_SECRET: "test-refresh-secret-at-least-32-characters",
  JWT_ACCESS_EXPIRATION_IN_MINUTES: 15, JWT_REFRESH_EXPIRATION_IN_DAYS: 7,
  COOKIE_SECRET: "test-cookie-secret-at-least-32-characters", CORS_ORIGIN: "http://localhost:5173",
  LLM_MODEL: "test", LLM_API_KEY: "test",
} }));
import { buildServer } from "./app.js";
import { authSessions } from "../modules/identity/infrastructure/security/auth-session.instance.js";
import { UnauthorizedError } from "../core/errors/app-error.js";
import { KyselyInstitutionalProfileRepository } from "../modules/identity/infrastructure/repositories/kysely-institutional-profile.repository.js";
import { InstitutionalProfile } from "../modules/identity/domain/institutional-profile.entity.js";
import { db } from "../infrastructure/database/database.js";
const payload = {
  sub: "00000000-0000-4000-8000-000000000001", email: "ana@example.com", role: "TEACHER" as const,
  sid: "00000000-0000-4000-8000-000000000002", token_version: 0, must_change_password: false,
};
const headers = { authorization: "Bearer test-token" };
let app: Awaited<ReturnType<typeof buildServer>>;
beforeAll(async () => { app = await buildServer(); });
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authSessions, "validate").mockResolvedValue({ ...payload });
});
afterAll(async () => { vi.restoreAllMocks(); await app.close(); await db.destroy(); });
describe("stage 1 HTTP boundaries (no external database)", () => {
  it.each(["/api/v1/auth/register", "/api/v1/sessions/preview", "/api/v1/sessions"])("removes the old public/bypass route %s", async (url) => {
    expect((await app.inject({ method: "POST", url, payload: {}, headers })).statusCode).toBe(404);
  });
  it("exposes current identity and protects profile reads", async () => {
    expect((await app.inject({ url: "/api/v1/auth/me", headers })).json().user).toMatchObject(payload);
    expect((await app.inject({ url: "/api/v1/profile/institutional" })).statusCode).toBe(401);
  });
  it("keeps profile read-only and uses the authenticated owner", async () => {
    const profile = InstitutionalProfile.create({ userId: payload.sub, teacherFullName: "Ana",
      specialty: "Comunicación", schoolName: "Escuela", ugel: "UGEL 01", dre: "DRE" });
    const find = vi.spyOn(KyselyInstitutionalProfileRepository.prototype, "findByUserId").mockResolvedValue(profile);
    expect((await app.inject({ url: "/api/v1/profile/institutional", headers })).json().teacher_full_name).toBe("Ana");
    expect(find).toHaveBeenCalledWith(payload.sub);
    expect((await app.inject({ method: "PUT", url: "/api/v1/profile/institutional", headers, payload: {} })).statusCode).toBe(404);
  });
  it("returns 403 for teacher administrative calls before body validation", async () => {
    const result = await app.inject({ method: "PATCH", url: "/api/v1/admin/users/" + payload.sub + "/subscription", headers, payload: {} });
    expect(result.statusCode).toBe(403);
  });
  it("requires an idempotency key and rejects frontend institutional identity", async () => {
    const result = await app.inject({ method: "POST", url: "/api/v1/sessions/generate", headers, payload: {} });
    expect(result.statusCode).toBe(400);
    expect(result.json().invalidParams).toBeDefined();
  });
  it("blocks generation and profile access while a password change is required", async () => {
    vi.mocked(authSessions.validate).mockResolvedValue({ ...payload, must_change_password: true });
    expect((await app.inject({ url: "/api/v1/auth/me", headers })).statusCode).toBe(200);
    expect((await app.inject({ url: "/api/v1/profile/institutional", headers })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/api/v1/sessions/generate", headers, payload: {} })).statusCode).toBe(403);
  });
  it("refreshes a restricted session and handles revoked credentials with 401", async () => {
    const refresh = vi.spyOn(authSessions, "refresh").mockResolvedValue({ accessToken: "restricted-access" });
    const result = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", cookies: { refreshToken: "restricted-refresh" } });
    expect(result.json().accessToken).toBe("restricted-access");
    expect(refresh).toHaveBeenCalledWith("restricted-refresh");
    refresh.mockRejectedValue(new UnauthorizedError("Sesión revocada"));
    expect((await app.inject({ method: "POST", url: "/api/v1/auth/refresh", cookies: { refreshToken: "old" } })).statusCode).toBe(401);
  });
  it("logs out only the current authentication session", async () => {
    const logout = vi.spyOn(authSessions, "logout").mockResolvedValue();
    const result = await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers });
    expect(result.statusCode).toBe(204);
    expect(logout).toHaveBeenCalledWith(payload);
    expect(result.headers["set-cookie"]).toContain("refreshToken=;");
  });
  it("replaces the cookie and access token after changing a password", async () => {
    const change = vi.spyOn(authSessions, "changePassword").mockResolvedValue({
      accessToken: "new-access", refreshToken: "new-refresh",
      user: { id: payload.sub, email: payload.email, role: payload.role, mustChangePassword: false },
    });
    const result = await app.inject({ method: "POST", url: "/api/v1/auth/change-password", headers,
      payload: { currentPassword: "CurrentPassword1!", newPassword: "NewPassword123!" } });
    expect(result.statusCode).toBe(200);
    expect(result.json().accessToken).toBe("new-access");
    expect(result.json().refreshToken).toBeUndefined();
    expect(result.headers["set-cookie"]).toContain("HttpOnly");
    expect(change).toHaveBeenCalledOnce();
  });
});
