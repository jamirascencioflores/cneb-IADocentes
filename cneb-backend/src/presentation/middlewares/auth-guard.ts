import { FastifyReply, FastifyRequest } from "fastify";
import {
  UnauthorizedError,
  ForbiddenError,
} from "../../core/errors/app-error.js";
import {
  JwtTokenService,
  TokenPayload,
} from "../../modules/identity/infrastructure/security/token.service.js";
import { UserRole } from "../../modules/identity/domain/user.entity.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

const tokenService = new JwtTokenService();

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
  try {
    const payload = tokenService.verifyAccessToken(token);
    request.user = payload;
  } catch {
    throw new UnauthorizedError("Token de acceso inválido o expirado.");
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
