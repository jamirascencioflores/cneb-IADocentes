import Fastify, { LogController } from "fastify";
import { profileRoutes } from "./http/routes/profile/profile.routes.js";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { env } from "../config/env.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { authRoutes } from "../modules/identity/infrastructure/controllers/auth.controller.js";
import { billingRoutes } from "../modules/billing/infrastructure/controllers/billing.controller.js";
import { curriculumRoutes } from "../modules/curriculum/infrastructure/controllers/curriculum.controller.js";
import { sessionRoutes } from "../modules/pedagogical-session/controllers/session.controller.js";
import { adminRoutes } from "../modules/admin/infrastructure/admin.controller.js";

const getLoggerConfig = () => {
  if (env.NODE_ENV === "test") return false;
  if (env.NODE_ENV === "development") {
    return {
      level: "debug",
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      },
    };
  }
  return { level: "info" };
};

export async function buildServer() {
  const server = Fastify({
    logger: getLoggerConfig(),
    // Passwords, bearer tokens and cookies must never appear in application logs.
    logController: new LogController({ disableRequestLogging: true }),
  });

  await server.register(helmet, { contentSecurityPolicy: true });
  await server.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });
  await server.register(cookie, {
    secret: env.COOKIE_SECRET,
    hook: "onRequest",
  });
  await server.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  server.setErrorHandler(errorHandler);

  server.get("/health", async () => ({
    status: "healthy",
    timestamp: new Date().toISOString(),
  }));

  await server.register(profileRoutes, { prefix: "/api/v1/profile" });
  await server.register(authRoutes, { prefix: "/api/v1/auth" });
  await server.register(billingRoutes, { prefix: "/api/v1" });
  await server.register(curriculumRoutes, { prefix: "/api/v1" });
  await server.register(sessionRoutes, { prefix: "/api/v1" });
  await server.register(adminRoutes, { prefix: "/api/v1/admin" });

  return server;
}
