import { z } from "zod";

const envSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .url("VITE_API_BASE_URL debe ser una URL válida"),
  VITE_APP_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  VITE_DOCX_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(15),
  VITE_SUPPORT_PHONE: z.string().default("0800-44040"),
});

export const env = envSchema.parse(import.meta.env);
export type EnvConfig = z.infer<typeof envSchema>;
