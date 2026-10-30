import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../../core/errors/app-error.js";

export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Route templates exclude client query values and URL parameters.
  const instance = request.routeOptions.url ?? "/";
  const administrative = instance.startsWith("/api/v1/admin/");
  if (error instanceof ZodError) {
    return reply
      .status(400)
      .send({
        type: "about:blank",
        title: "Datos inválidos",
        status: 400,
        detail: "Revisa los campos enviados.",
        instance,
        invalidParams: error.issues.map((issue) => ({
          name: issue.path.join("."),
          reason: "Valor inválido.",
        })),
      });
  }
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      type: error.type,
      title: error.constructor.name,
      status: error.statusCode,
      detail: administrative ? "La operación administrativa no pudo completarse." : error.message,
      instance,
      ...(!administrative && error.details ? { invalidParams: error.details } : {}),
    });
  }

  if ("validation" in error && error.validation) {
    return reply.status(400).send({
      type: "https://api.cneb-planner.pe/errors/bad-request",
      title: "Bad Request",
      status: 400,
      detail: "Error de validación en los parámetros de entrada",
      instance,
    });
  }

  if ("statusCode" in error && [400, 413, 415, 429].includes(Number(error.statusCode))) {
    return reply.status(Number(error.statusCode)).send({ type: "about:blank", title: "Solicitud rechazada",
      status: Number(error.statusCode), detail: "Revisa la solicitud y sus límites.", instance });
  }
  // PostgreSQL errors may carry a failing row, hashes, SQL parameters or connection URLs.
  // Never send an Error object, stack, message, request body or headers to the logger.
  request.log.error({ event: "request_failed", requestId: request.id }, "Error interno inesperado");

  return reply.status(500).send({
    type: "https://api.cneb-planner.pe/errors/internal-server-error",
    title: "Internal Server Error",
    status: 500,
    detail: "Ha ocurrido un error interno inesperado.",
    instance,
  });
}
