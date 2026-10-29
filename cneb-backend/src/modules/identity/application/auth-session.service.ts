import { randomUUID } from "node:crypto";
import type { Kysely, Transaction } from "kysely";
import { z } from "zod";
import type { DatabaseSchema } from "../../../infrastructure/database/types.js";
import { UnauthorizedError, ValidationError } from "../../../core/errors/app-error.js";
import type { User } from "../domain/user.entity.js";
import type { IHashService } from "../infrastructure/security/hash.service.js";
import type { ITokenService, TokenPayload } from "../infrastructure/security/token.service.js";

const claimsSchema = z.object({
  sub: z.string().uuid(), sid: z.string().uuid(),
  role: z.enum(["SUPERADMIN", "TEACHER"]), email: z.string(),
  token_version: z.number().int().nonnegative(),
  must_change_password: z.boolean(),
});
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string; mustChangePassword: boolean };
}
export interface ISessionIssuer { issue(user: User): Promise<SessionTokens>; }

export class AuthSessionService implements ISessionIssuer {
  constructor(
    private readonly db: Kysely<DatabaseSchema>,
    private readonly tokens: ITokenService,
    private readonly hash: IHashService,
    private readonly refreshDays: number,
  ) {}

  async validate(token: string, kind: "access" | "refresh"): Promise<TokenPayload> {
    let claims: TokenPayload;
    try {
      claims = claimsSchema.parse(kind === "access"
        ? this.tokens.verifyAccessToken(token) : this.tokens.verifyRefreshToken(token));
    } catch { throw new UnauthorizedError("Sesión inválida o expirada."); }
    const row = await this.db.selectFrom("users")
      .innerJoin("auth_sessions as s", "s.user_id", "users.id")
      .selectAll("users").select(["s.revoked_at", "s.expires_at"])
      .where("users.id", "=", claims.sub).where("s.id", "=", claims.sid).executeTakeFirst();
    if (!row || !row.is_active || row.revoked_at || row.expires_at <= new Date()
      || row.token_version !== claims.token_version) {
      throw new UnauthorizedError("Sesión inválida o cuenta desactivada.");
    }
    return { sub: row.id, email: row.email, role: row.role, sid: claims.sid,
      token_version: row.token_version, must_change_password: row.must_change_password };
  }

  async issue(user: User): Promise<SessionTokens> {
    return this.db.transaction().execute(async (trx) => {
      const row = await trx.selectFrom("users").selectAll().where("id", "=", user.id)
        .forUpdate().executeTakeFirst();
      if (!row?.is_active || row.password_hash !== user.passwordHash || row.token_version !== user.tokenVersion)
        throw new UnauthorizedError("Credenciales inválidas.");
      return this.create(trx, row);
    });
  }

  private async create(trx: Transaction<DatabaseSchema>, row: {
    id: string; email: string; role: "SUPERADMIN" | "TEACHER";
    token_version: number; must_change_password: boolean;
  }): Promise<SessionTokens> {
    const sid = randomUUID();
    await trx.insertInto("auth_sessions").values({ id: sid, user_id: row.id,
      expires_at: new Date(Date.now() + this.refreshDays * 86400000), revoked_at: null }).execute();
    const payload: TokenPayload = { sub: row.id, email: row.email, role: row.role,
      token_version: row.token_version, must_change_password: row.must_change_password, sid };
    return { accessToken: this.tokens.generateAccessToken(payload),
      refreshToken: this.tokens.generateRefreshToken(payload),
      user: { id: row.id, email: row.email, role: row.role, mustChangePassword: row.must_change_password } };
  }

  async refresh(token: string): Promise<{ accessToken: string }> {
    const payload = await this.validate(token, "refresh");
    return { accessToken: this.tokens.generateAccessToken(payload) };
  }

  async logout(payload: TokenPayload): Promise<void> {
    await this.db.updateTable("auth_sessions").set({ revoked_at: new Date() })
      .where("id", "=", payload.sid).where("user_id", "=", payload.sub).execute();
  }

  async changePassword(payload: TokenPayload, currentPassword: string, newPassword: string): Promise<SessionTokens> {
    const newHash = await this.hash.hash(newPassword);
    return this.db.transaction().execute(async (trx) => {
      const row = await trx.selectFrom("users").selectAll().where("id", "=", payload.sub)
        .forUpdate().executeTakeFirst();
      const session = await trx.selectFrom("auth_sessions").selectAll()
        .where("id", "=", payload.sid).where("user_id", "=", payload.sub).forUpdate().executeTakeFirst();
      if (!row?.is_active || row.token_version !== payload.token_version || !session
        || session.revoked_at || session.expires_at <= new Date())
        throw new UnauthorizedError("Sesión inválida.");
      if (!await this.hash.compare(currentPassword, row.password_hash))
        throw new UnauthorizedError("La contraseña actual es incorrecta.");
      if (await this.hash.compare(newPassword, row.password_hash))
        throw new ValidationError("La nueva contraseña debe ser diferente.");
      const updated = await trx.updateTable("users").set({
        password_hash: newHash, must_change_password: false,
        token_version: row.token_version + 1, updated_at: new Date(),
      }).where("id", "=", row.id).returningAll().executeTakeFirstOrThrow();
      await trx.updateTable("auth_sessions").set({ revoked_at: new Date() })
        .where("user_id", "=", row.id).where("revoked_at", "is", null).execute();
      return this.create(trx, updated);
    });
  }
}
