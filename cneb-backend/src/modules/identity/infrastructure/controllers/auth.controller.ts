import { UnauthorizedError } from "../../../../core/errors/app-error.js";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../../../infrastructure/database/database.js";
import { env } from "../../../../config/env.js";
import { KyselyUserRepository } from "../repositories/kysely-user.repository.js";
import { Argon2HashService } from "../security/hash.service.js";
import { JwtTokenService } from "../security/token.service.js";
import { RegisterTeacherUseCase } from "../../application/register-teacher.use-case.js";
import { LoginUseCase } from "../../application/login.use-case.js";
import { registerSchema, loginSchema } from "./auth.schemas.js";
import { authenticate } from "../../../../presentation/middlewares/auth-guard.js";

export async function authRoutes(server: FastifyInstance) {
  const userRepository = new KyselyUserRepository(db);
  const hashService = new Argon2HashService();
  const tokenService = new JwtTokenService();

  const registerUseCase = new RegisterTeacherUseCase(
    userRepository,
    hashService,
    db,
  );
  const loginUseCase = new LoginUseCase(
    userRepository,
    hashService,
    tokenService,
  );

  // POST /api/v1/auth/register
  server.post(
    "/register",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = registerSchema.parse(request.body);
      const result = await registerUseCase.execute(dto);
      return reply.status(201).send(result);
    },
  );

  // POST /api/v1/auth/login
  server.post(
    "/login",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = loginSchema.parse(request.body);
      const result = await loginUseCase.execute(dto);

      // Refresh Token en cookie segura
      reply.setCookie("refreshToken", result.refreshToken, {
        path: "/api/v1/auth/refresh",
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: env.JWT_REFRESH_EXPIRATION_IN_DAYS * 24 * 60 * 60,
      });

      return reply.status(200).send({
        accessToken: result.accessToken,
        user: result.user,
      });
    },
  );

  server.post("/refresh", async (request, reply) => {
    try {
      const refreshToken = request.cookies.refreshToken;
      if (!refreshToken) throw new UnauthorizedError("Sesión expirada.");
      const payload = tokenService.verifyRefreshToken(refreshToken);
      const user = await userRepository.findById(payload.sub);
      if (!user?.isActive) throw new UnauthorizedError("Sesión expirada.");
      return {
        accessToken: tokenService.generateAccessToken({
          sub: user.id,
          email: user.email,
          role: user.role,
        }),
      };
    } catch (error) {
      if (
        !(error instanceof UnauthorizedError) &&
        !(
          error instanceof Error &&
          ["TokenExpiredError", "JsonWebTokenError", "NotBeforeError"].includes(
            error.name,
          )
        )
      )
        throw error;
      reply.clearCookie("refreshToken", {
        path: "/api/v1/auth/refresh",
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
      });
      throw new UnauthorizedError("Sesión expirada. Inicia sesión nuevamente.");
    }
  });

  server.post("/logout", async (_request, reply) => {
    reply.clearCookie("refreshToken", {
      path: "/api/v1/auth/refresh",
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
    });
    return reply.status(204).send();
  });

  // GET /api/v1/auth/me (Ruta protegida para verificar identidad)
  server.get(
    "/me",
    { preHandler: [authenticate] },
    async (request: FastifyRequest) => {
      return { user: request.user };
    },
  );
}
