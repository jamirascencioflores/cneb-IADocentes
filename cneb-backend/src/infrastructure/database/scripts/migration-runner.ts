import { createHash } from "node:crypto";
import { sql, type Kysely } from "kysely";
import type { DatabaseSchema } from "../types.js";

export interface MigrationSource { name: string; source: string; }
// Caller supplies one reserved connection. No environment loading, pools or CLI side effects.
export async function applyMigrations(
  connection: Kysely<DatabaseSchema>, migrations: readonly MigrationSource[], baselineExisting = false,
  onApplied: (name: string) => void = () => undefined,
): Promise<string[]> {
  await sql`SELECT pg_advisory_lock(72638109)`.execute(connection);
  const applied: string[] = [];
  try {
    await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`.execute(connection);
    for (const { name, source } of migrations) {
      const checksum = createHash("sha256").update(source).digest("hex");
      const previous = await sql<{ checksum: string }>`SELECT checksum FROM schema_migrations WHERE name = ${name}`.execute(connection);
      if (previous.rows[0]) {
        if (previous.rows[0].checksum !== checksum) throw new Error("Migración aplicada modificada: " + name);
        continue;
      }
      await connection.transaction().execute(async (trx) => {
        if (!(baselineExisting && name === "001_initial_schema.sql")) await sql.raw(source).execute(trx);
        await sql`INSERT INTO schema_migrations(name, checksum) VALUES (${name}, ${checksum})`.execute(trx);
      });
      applied.push(name);
      onApplied(name);
    }
    return applied;
  } finally { await sql`SELECT pg_advisory_unlock(72638109)`.execute(connection); }
}
