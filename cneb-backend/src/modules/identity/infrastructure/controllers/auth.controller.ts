import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { db } from "../../../../infrastructure/database/database.js";
import { env } from "../../../../config/env.js";
import { UnauthorizedError } from "../../../../core/errors/app-error.js";
import { KyselyUserRepository } from "../repositories/kysely-user.repository.js";
import { Argon2HashService } from "../security/hash.service.js";
import { authSessions } from "../security/auth-session.instance.js";
import { LoginUseCase } from "../../application/login.use-case.js";
import { loginSchema } from "./auth.schemas.js";
import { authenticate } from "../../../../presentation/middlewares/auth-guard.js";

const changeSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(256),
}).strict();
const cookieOptions = {
  path: "/api/v1/auth/refresh", httpOnly: true,
  secure: env.NODE_ENV === "production", sameSite: "strict" as const,
};
function setRefresh(reply: FastifyReply, token: string) {
  reply.setCookie("refreshToken", token, {
    ...cookieOptions, maxAge: env.JWT_REFRESH_EXPIRATION_IN_DAYS * 86400,
  });
  reply.header("Cache-Control", "no-store");
}
export async function authRoutes(server: FastifyInstance) {
  const login = new LoginUseCase(new KyselyUserRepository(db), new Argon2HashService(), authSessions);
  server.post("/login", async (request, reply) => {
    const result = await login.execute(loginSchema.parse(request.body));
    setRefresh(reply, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  });
  server.get("/me", { preHandler: [authenticate] }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    return { user: request.user };
  });
  server.post("/refresh", async (request, reply) => {
    const token = request.cookies.refreshToken;
    if (!token) throw new UnauthorizedError("Sesión expirada.");
    try {
      const result = await authSessions.refresh(token);
      reply.header("Cache-Control", "no-store");
      return result;
    } catch (error) {
      if (error instanceof UnauthorizedError) reply.clearCookie("refreshToken", cookieOptions);
      throw error;
    }
  });
  server.post("/logout", { preHandler: [authenticate] }, async (request, reply) => {
    await authSessions.logout(request.user!);
    reply.clearCookie("refreshToken", cookieOptions);
    return reply.status(204).send();
  });
  server.post("/change-password", { preHandler: [authenticate] }, async (request, reply) => {
    const body = changeSchema.parse(request.body);
    const result = await authSessions.changePassword(request.user!, body.currentPassword, body.newPassword);
    setRefresh(reply, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  });
}
