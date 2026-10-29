import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { sql, type Kysely } from "kysely";
import type { DatabaseSchema } from "../types.js";
import { databaseTarget, reportScriptError, scriptDatabase } from "./script-database.js";
import { walletConfigurationErrors } from "../../../modules/billing/domain/credit-wallet.entity.js";

const directory = new URL("../migrations/", import.meta.url);
const initialTables = [
  "users", "institutional_profiles", "credit_wallets", "wallet_transactions",
  "areas", "competencies", "capacities", "performances", "learning_sessions",
  "session_competencies", "session_moments", "evaluation_instruments", "evaluation_criteria",
];
export async function preflight(db: Kysely<DatabaseSchema>) {
  const tables = await sql<{ name: string }>`SELECT tablename AS name FROM pg_tables WHERE schemaname = current_schema()`.execute(db);
  const present = new Set(tables.rows.map((row) => row.name));
  const coreCount = initialTables.filter((table) => present.has(table)).length;
  if (coreCount && coreCount !== initialTables.length)
    throw new Error("El esquema inicial está incompleto. Revísalo antes de establecer la línea base.");
  if (present.has("credit_wallets")) {
    const wallets = await db.selectFrom("credit_wallets")
      .select(["id", "user_id", "balance", "plan_type", "is_unlimited", "expires_at"]).execute();
    const incompatible = wallets.flatMap((wallet) => {
      const errors = walletConfigurationErrors({
        balance: wallet.balance, planType: wallet.plan_type,
        isUnlimited: wallet.is_unlimited, expiresAt: wallet.expires_at,
      });
      return errors.length
        ? ["wallet_id=" + wallet.id + ", user_id=" + wallet.user_id + ": " + errors.join(" ")] : [];
    });
    if (incompatible.length) throw new Error(
      "Billeteras incompatibles. Migraciones detenidas; no se corrigieron ni eliminaron datos.\n"
      + incompatible.join("\n"),
    );
  }
  if (present.has("institutional_profiles")) {
    const duplicates = await sql<{ user_id: string }>`SELECT user_id FROM institutional_profiles GROUP BY user_id HAVING count(*) > 1 ORDER BY user_id`.execute(db);
    if (duplicates.rows.length) throw new Error("Perfiles duplicados. No se modificaron registros. user_id: " + duplicates.rows.map((r) => r.user_id).join(", "));
    const missing = await sql<{ id: string }>`SELECT u.id FROM users u LEFT JOIN institutional_profiles p ON p.user_id = u.id WHERE u.role = 'TEACHER' AND p.id IS NULL`.execute(db);
    console.log("Docentes sin perfil (generación/exportación bloqueadas):", missing.rows.map((r) => r.id));
  }
  return { existing: coreCount === initialTables.length, hasHistory: present.has("schema_migrations") };
}
async function main() {
  console.log("Destino:", databaseTarget());
  const db = scriptDatabase();
  try {
    const files = (await fs.readdir(directory)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
    const check = await preflight(db);
    console.log("Migraciones:", files.join(", "));
    if (!process.argv.includes("--apply")) {
      console.log("Solo comprobación; sin escrituras. --apply ejecuta pendientes; --baseline-existing registra 001 en una base ya inicializada.");
      return;
    }
    if (check.existing && !check.hasHistory && !process.argv.includes("--baseline-existing"))
      throw new Error("Base existente sin historial. Requiere --baseline-existing después de revisar el esquema.");
    await db.connection().execute(async (connection) => {
      await sql`SELECT pg_advisory_lock(72638109)`.execute(connection);
      try {
        await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
          name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`.execute(connection);
        for (const name of files) {
          const source = await fs.readFile(new URL(name, directory), "utf8");
          const checksum = createHash("sha256").update(source).digest("hex");
          const previous = await sql<{ checksum: string }>`SELECT checksum FROM schema_migrations WHERE name = ${name}`.execute(connection);
          if (previous.rows[0]) {
            if (previous.rows[0].checksum !== checksum) throw new Error("Migración aplicada modificada: " + name);
            continue;
          }
          await connection.transaction().execute(async (trx) => {
            if (!(check.existing && name === "001_initial_schema.sql")) await sql.raw(source).execute(trx);
            await sql`INSERT INTO schema_migrations(name, checksum) VALUES (${name}, ${checksum})`.execute(trx);
          });
          console.log("Aplicada:", name);
        }
      } finally { await sql`SELECT pg_advisory_unlock(72638109)`.execute(connection); }
    });
  } finally { await db.destroy(); }
}
if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()) {
  main().catch(reportScriptError);
}
