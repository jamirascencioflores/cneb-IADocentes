import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),

  DATABASE_URL: z.string().url(),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().default(20),

  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRATION_IN_MINUTES: z.coerce.number().default(15),
  JWT_REFRESH_EXPIRATION_IN_DAYS: z.coerce.number().default(7),
  COOKIE_SECRET: z.string().min(32),

  LLM_PROVIDER: z.enum(["openai", "anthropic", "gemini"]).default("gemini"),
  LLM_API_KEY: z.string().min(1),
  LLM_MODEL: z.string().default("gemini-1.5-pro"),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Variables de entorno inválidas:");
  console.error(JSON.stringify(_env.error.format(), null, 2));
  process.exit(1);
}

export const env = _env.data;
export type Env = z.infer<typeof envSchema>;
