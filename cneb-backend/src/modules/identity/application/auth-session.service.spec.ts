import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthSessionService } from "./auth-session.service.js";
import { UnauthorizedError } from "../../../core/errors/app-error.js";
const claims = {
  sub: "00000000-0000-4000-8000-000000000001", sid: "00000000-0000-4000-8000-000000000002",
  email: "teacher@example.com", role: "TEACHER" as const, token_version: 3, must_change_password: true,
};
describe("current database authorization and device sessions", () => {
  let row: any;
  let query: any;
  let db: any;
  let tokens: any;
  let hash: any;
  let service: AuthSessionService;
  beforeEach(() => {
    row = { id: claims.sub, email: claims.email, role: claims.role, token_version: 3,
      must_change_password: true, is_active: true, password_hash: "old-hash",
      revoked_at: null, expires_at: new Date(Date.now() + 86400000) };
    query = { selectAll: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), forUpdate: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(), values: vi.fn().mockReturnThis(), returningAll: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn(async () => row),
      executeTakeFirstOrThrow: vi.fn(async () => ({ ...row, token_version: 4, must_change_password: false })),
      execute: vi.fn(async () => []),
    };
    db = { selectFrom: vi.fn(() => query), updateTable: vi.fn(() => query), insertInto: vi.fn(() => query),
      transaction: () => ({ execute: (callback: any) => callback(db) }) };
    tokens = { verifyAccessToken: vi.fn(() => claims), verifyRefreshToken: vi.fn(() => claims),
      generateAccessToken: vi.fn(() => "new-access"), generateRefreshToken: vi.fn(() => "new-refresh") };
    hash = { hash: vi.fn(async () => "new-hash"), compare: vi.fn(async (password: string) => password === "current") };
    service = new AuthSessionService(db, tokens, hash, 7);
  });
  it.each(["inactive", "missing", "version", "revoked", "expired"])("rejects %s credentials even with a correctly signed token", async (condition) => {
    if (condition === "inactive") row.is_active = false;
    if (condition === "missing") row = undefined;
    if (condition === "version") row.token_version = 4;
    if (condition === "revoked") row.revoked_at = new Date();
    if (condition === "expired") row.expires_at = new Date(0);
    await expect(service.validate("jwt", "access")).rejects.toThrow(UnauthorizedError);
    await expect(service.validate("jwt", "refresh")).rejects.toThrow(UnauthorizedError);
  });
  it("reads the current role and keeps refresh restricted until the password is changed", async () => {
    row.role = "SUPERADMIN";
    await expect(service.refresh("refresh")).resolves.toEqual({ accessToken: "new-access" });
    expect(tokens.generateAccessToken).toHaveBeenCalledWith(expect.objectContaining({
      role: "SUPERADMIN", must_change_password: true, token_version: 3, sid: claims.sid,
    }));
  });
  it("revokes only this device without increasing token_version", async () => {
    await service.logout(claims);
    expect(db.updateTable).toHaveBeenCalledWith("auth_sessions");
    expect(db.updateTable).not.toHaveBeenCalledWith("users");
    expect(query.where).toHaveBeenCalledWith("id", "=", claims.sid);
  });
  it("changes the hash and version atomically and issues a fresh unrestricted session", async () => {
    const result = await service.changePassword(claims, "current", "new-password-123");
    expect(hash.hash).toHaveBeenCalledWith("new-password-123");
    expect(query.set).toHaveBeenCalledWith(expect.objectContaining({
      password_hash: "new-hash", must_change_password: false, token_version: 4,
    }));
    expect(tokens.generateAccessToken).toHaveBeenCalledWith(expect.objectContaining({
      must_change_password: false, token_version: 4,
    }));
    expect(result.refreshToken).toBe("new-refresh");
  });
  it("rejects an incorrect current password without updating the account", async () => {
    await expect(service.changePassword(claims, "wrong", "new-password-123")).rejects.toThrow(UnauthorizedError);
    expect(db.updateTable).not.toHaveBeenCalled();
  });
});
