import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
vi.mock("../config/env.js", () => ({
  env: {
    NODE_ENV: "test",
    DATABASE_URL: "postgres://test:test@localhost:5432/test",
    DATABASE_MAX_CONNECTIONS: 1,
    JWT_ACCESS_SECRET: "test-access-secret-at-least-32-characters",
    JWT_REFRESH_SECRET: "test-refresh-secret-at-least-32-characters",
    JWT_ACCESS_EXPIRATION_IN_MINUTES: 15,
    JWT_REFRESH_EXPIRATION_IN_DAYS: 7,
    COOKIE_SECRET: "test-cookie-secret-at-least-32-characters",
    CORS_ORIGIN: "http://localhost:5173",
    LLM_MODEL: "test",
    LLM_API_KEY: "test",
  },
}));
import { buildServer } from "./app.js";
import { JwtTokenService } from "../modules/identity/infrastructure/security/token.service.js";
import { KyselyUserRepository } from "../modules/identity/infrastructure/repositories/kysely-user.repository.js";
import { User } from "../modules/identity/domain/user.entity.js";
import { InstitutionalProfile } from "../modules/identity/domain/institutional-profile.entity.js";
import { KyselyInstitutionalProfileRepository } from "../modules/identity/infrastructure/repositories/kysely-institutional-profile.repository.js";
import { db } from "../infrastructure/database/database.js";
const tokens = new JwtTokenService();
const payload = {
  sub: "00000000-0000-4000-8000-000000000001",
  email: "ana@example.com",
  role: "TEACHER" as const,
};
let app: Awaited<ReturnType<typeof buildServer>>;
beforeAll(async () => {
  app = await buildServer();
});
afterAll(async () => {
  await app.close();
  await db.destroy();
  vi.restoreAllMocks();
});
describe("registered HTTP routes", () => {
  it("exposes the user envelope consumed by the frontend", async () => {
    const result = await app.inject({
      url: "/api/v1/auth/me",
      headers: {
        authorization: `Bearer ${tokens.generateAccessToken(payload)}`,
      },
    });
    expect(result.statusCode).toBe(200);
    expect(result.json().user).toMatchObject(payload);
  });
  it("registers and protects institutional routes", async () => {
    const result = await app.inject({ url: "/api/v1/profile/institutional" });
    expect(result.statusCode).toBe(401);
  });
  it("reads the institutional profile of the authenticated teacher", async () => {
    const profile = InstitutionalProfile.create({
      userId: payload.sub,
      teacherFullName: "Ana Docente",
      specialty: "Comunicación",
      schoolName: "Escuela de prueba",
      ugel: "UGEL 01",
      dre: "DRE de prueba",
      principalName: "Rosa Directora",
    });
    const find = vi
      .spyOn(KyselyInstitutionalProfileRepository.prototype, "findByUserId")
      .mockResolvedValue(profile);
    try {
      const result = await app.inject({
        url: "/api/v1/profile/institutional",
        headers: { authorization: `Bearer ${tokens.generateAccessToken(payload)}` },
      });
      expect(result.statusCode).toBe(200);
      expect(find).toHaveBeenCalledWith(payload.sub);
      expect(result.json()).toMatchObject({
        user_id: payload.sub,
        teacher_full_name: "Ana Docente",
        specialty: "Comunicación",
        school_name: "Escuela de prueba",
        ugel: "UGEL 01",
        dre: "DRE de prueba",
        principal_name: "Rosa Directora",
      });
      find.mockResolvedValue(null);
      const missing = await app.inject({
        url: "/api/v1/profile/institutional",
        headers: { authorization: `Bearer ${tokens.generateAccessToken(payload)}` },
      });
      expect(missing.statusCode).toBe(404);
      expect(missing.json().detail).toContain("configurada por el administrador");
    } finally {
      find.mockRestore();
    }
  });
  it("does not expose an institutional update route to teachers", async () => {
    const upsert = vi.spyOn(KyselyInstitutionalProfileRepository.prototype, "upsert");
    try {
      const result = await app.inject({
        method: "PUT",
        url: "/api/v1/profile/institutional",
        headers: { authorization: `Bearer ${tokens.generateAccessToken(payload)}` },
        payload: {
          teacher_full_name: "Nombre reemplazado",
          specialty: "Matemática",
          school_name: "Otra escuela",
          ugel: "Otra UGEL",
          dre: "Otra DRE",
          principal_name: "Otro director",
        },
      });
      expect(result.statusCode).toBe(404);
      expect(upsert).not.toHaveBeenCalled();
    } finally {
      upsert.mockRestore();
    }
  });
  it("returns 400 for invalid Zod input before touching the database", async () => {
    const result = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {},
      headers: {
        authorization: `Bearer ${tokens.generateAccessToken(payload)}`,
      },
    });
    expect(result.statusCode).toBe(400);
    expect(result.json().invalidParams.length).toBeGreaterThan(0);
  });
  it("refreshes a valid active user using the HttpOnly cookie", async () => {
    const find = vi
      .spyOn(KyselyUserRepository.prototype, "findById")
      .mockResolvedValue(
        User.reconstitute({
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          passwordHash: "unused",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
    const result = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      cookies: { refreshToken: tokens.generateRefreshToken(payload) },
    });
    expect(result.statusCode).toBe(200);
    expect(tokens.verifyAccessToken(result.json().accessToken)).toMatchObject(
      payload,
    );
    find.mockResolvedValue(null);
    const denied = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      cookies: { refreshToken: tokens.generateRefreshToken(payload) },
    });
    expect(denied.statusCode).toBe(401);
    find.mockRestore();
  });
  it("rejects a missing refresh cookie and clears it on logout", async () => {
    expect(
      (await app.inject({ method: "POST", url: "/api/v1/auth/refresh" }))
        .statusCode,
    ).toBe(401);
    const result = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
    });
    expect(result.statusCode).toBe(204);
    expect(result.headers["set-cookie"]).toContain("refreshToken=;");
  });
});
