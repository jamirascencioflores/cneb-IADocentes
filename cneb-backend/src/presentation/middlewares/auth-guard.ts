import { FastifyReply, FastifyRequest } from "fastify";
import {
  UnauthorizedError,
  ForbiddenError,
} from "../../core/errors/app-error.js";
import { TokenPayload } from "../../modules/identity/infrastructure/security/token.service.js";
import { authSessions } from "../../modules/identity/infrastructure/security/auth-session.instance.js";
import { UserRole } from "../../modules/identity/domain/user.entity.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError(
      "Cabecera Authorization no provista o con formato inválido.",
    );
  }

  const token = authHeader.substring(7);
  request.user = await authSessions.validate(token, "access");
  const allowed = new Set([
    "GET /api/v1/auth/me", "POST /api/v1/auth/change-password",
    "POST /api/v1/auth/refresh", "POST /api/v1/auth/logout",
  ]);
  if (request.user.must_change_password
    && !allowed.has(request.method + " " + request.routeOptions.url)) {
    throw new ForbiddenError("Debes cambiar tu contraseña antes de continuar.");
  }
}

export function authorize(roles: UserRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError("No autenticado.");
    }

    if (!roles.includes(request.user.role)) {
      throw new ForbiddenError(
        "Permisos insuficientes para acceder a este recurso.",
      );
    }
  };
}
