import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sql, type Kysely } from "kysely";
import type { DatabaseSchema } from "../types.js";
import { databaseTarget, reportScriptError, scriptDatabase } from "./script-database.js";
import { walletConfigurationErrors } from "../../../modules/billing/domain/credit-wallet.entity.js";
import { applyMigrations } from "./migration-runner.js";

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
    const incompatible = await sql<{ id: string }>`SELECT u.id FROM users u WHERE
      (u.role = 'TEACHER' AND (
        (SELECT count(*) FROM institutional_profiles p WHERE p.user_id = u.id) <> 1 OR
        (SELECT count(*) FROM credit_wallets w WHERE w.user_id = u.id) <> 1
      )) OR (u.role = 'SUPERADMIN' AND (
        EXISTS (SELECT 1 FROM institutional_profiles p WHERE p.user_id = u.id) OR
        EXISTS (SELECT 1 FROM credit_wallets w WHERE w.user_id = u.id)
      )) ORDER BY u.id`.execute(db);
    if (incompatible.rows.length) throw new Error("Composición docente incompatible. No se corrigieron registros. user_id: "
      + incompatible.rows.map((row) => row.id).join(", "));
  }
  if (present.has("users")) {
    const emails = await sql<{ id: string }>`SELECT id FROM users
      WHERE email <> lower(btrim(email)) OR email !~ '^[!-~]+$'
        OR lower(btrim(email)) IN (SELECT lower(btrim(email)) FROM users GROUP BY lower(btrim(email)) HAVING count(*) > 1)
      ORDER BY id`.execute(db);
    if (emails.rows.length) throw new Error("Correos incompatibles o duplicados. No se corrigieron registros. user_id: "
      + emails.rows.map((row) => row.id).join(", "));
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
    const migrations = await Promise.all(files.map(async (name) => ({ name,
      source: await fs.readFile(new URL(name, directory), "utf8") })));
    await db.connection().execute((connection) => applyMigrations(connection, migrations, check.existing,
      (name) => console.log("Aplicada:", name)));
  } finally { await db.destroy(); }
}
if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()) {
  main().catch(reportScriptError);
}
