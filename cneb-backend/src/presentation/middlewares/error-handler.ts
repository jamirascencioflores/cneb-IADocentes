import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../core/errors/app-error.js";
import { env } from "../../config/env.js";

export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      type: error.type,
      title: error.constructor.name,
      status: error.statusCode,
      detail: error.message,
      instance: request.url,
      ...(error.details ? { invalidParams: error.details } : {}),
    });
  }

  if ("validation" in error && error.validation) {
    return reply.status(400).send({
      type: "https://api.cneb-planner.pe/errors/bad-request",
      title: "Bad Request",
      status: 400,
      detail: "Error de validación en los parámetros de entrada",
      instance: request.url,
      invalidParams: error.validation,
    });
  }

  request.log.error(error);

  return reply.status(500).send({
    type: "https://api.cneb-planner.pe/errors/internal-server-error",
    title: "Internal Server Error",
    status: 500,
    detail:
      env.NODE_ENV === "production"
        ? "Ha ocurrido un error interno inesperado."
        : error.message,
    instance: request.url,
  });
}
