import Fastify from "fastify";
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

const getLoggerConfig = () => {
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

const server = Fastify({
  logger: getLoggerConfig(),
});

await server.register(helmet, { contentSecurityPolicy: true });
await server.register(cors, {
  origin: env.CORS_ORIGIN,
  credentials: true,
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

const start = async () => {
  try {
    await server.listen({ port: env.PORT, host: env.HOST });
    server.log.info(`Servidor escuchando en http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

await server.register(authRoutes, { prefix: "/api/v1/auth" });
await server.register(billingRoutes, { prefix: "/api/v1" });
await server.register(curriculumRoutes, { prefix: "/api/v1" });
await server.register(sessionRoutes, { prefix: '/api/v1' });

void start();
