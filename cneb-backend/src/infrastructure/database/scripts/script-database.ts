import "dotenv/config";
import pg from "pg";
import { Kysely, PostgresDialect } from "kysely";
import type { DatabaseSchema } from "../types.js";

export function databaseTarget(value = process.env.DATABASE_URL): string {
  if (!value) throw new Error("DATABASE_URL es obligatoria.");
  const url = new URL(value);
  return url.protocol + "//" + url.hostname + ":" + (url.port || "5432") + url.pathname;
}
export function scriptDatabase() {
  databaseTarget();
  return new Kysely<DatabaseSchema>({ dialect: new PostgresDialect({
    pool: new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 }),
  }) });
}
export function reportScriptError(error: unknown) {
  // Never serialize connection options, arguments or SQL parameters.
  const message = error instanceof Error ? error.message : "Operación fallida";
  console.error(message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[DATABASE_URL oculta]"));
  process.exitCode = 1;
}
