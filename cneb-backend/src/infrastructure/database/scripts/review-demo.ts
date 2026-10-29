import { parseArgs } from "node:util";
import { sql } from "kysely";
import { databaseTarget, reportScriptError, scriptDatabase } from "./script-database.js";

async function main() {
  const { values } = parseArgs({ options: {
    email: { type: "string" }, action: { type: "string", default: "review" },
    confirm: { type: "string" }, apply: { type: "boolean" },
  } });
  const email = values.email?.trim().toLowerCase();
  if (!email || !email.split("@")[0]?.startsWith("docente.demo"))
    throw new Error("Indica el correo exacto de la cuenta local docente.demo.");
  console.log("Destino:", databaseTarget());
  if (!values.apply) { console.log("Preparado; sin consultas ni escrituras. Acción:", values.action); return; }
  const db = scriptDatabase();
  try {
    await db.transaction().execute(async (trx) => {
      const user = await trx.selectFrom("users").select(["id", "email", "role", "is_active"])
        .where("email", "=", email).forUpdate().executeTakeFirst();
      if (!user) { console.log("Cuenta no encontrada."); return; }
      if (user.role !== "TEACHER") throw new Error("La cuenta no es TEACHER.");
      const sessions = await trx.selectFrom("learning_sessions").select("id").where("user_id", "=", user.id).execute();
      const movements = await trx.selectFrom("wallet_transactions as t")
        .innerJoin("credit_wallets as w", "w.id", "t.wallet_id").select("t.id").where("w.user_id", "=", user.id).execute();
      const requests = await trx.selectFrom("generation_requests").select("id").where("user_id", "=", user.id).execute();
      const profile = await trx.selectFrom("institutional_profiles").selectAll().where("user_id", "=", user.id).execute();
      const wallet = await trx.selectFrom("credit_wallets").selectAll().where("user_id", "=", user.id).execute();
      console.log({ user, profile, wallet, sessions: sessions.length, movements: movements.length, generations: requests.length });
      if (sessions.length || movements.length || requests.length) console.log("Recomendación: desactivar para conservar el historial.");
      if (values.action === "review") return;
      if (values.confirm !== user.id) throw new Error("Requiere --confirm con el UUID mostrado durante la revisión.");
      if (values.action === "deactivate") {
        await trx.updateTable("users").set({ is_active: false, updated_at: new Date() }).where("id", "=", user.id).execute();
      } else if (values.action === "delete") {
        const host = new URL(process.env.DATABASE_URL!).hostname;
        if (process.env.NODE_ENV !== "development" || !["localhost", "127.0.0.1", "[::1]"].includes(host))
          throw new Error("La eliminación se permite únicamente en entorno local confirmado.");
        if (sessions.length || movements.length || requests.length) throw new Error("Tiene historial; no se eliminará.");
        const audit = await sql<{ count: string }>`SELECT count(*)::text AS count FROM wallet_transactions WHERE actor_user_id = ${user.id}`.execute(trx);
        if (audit.rows[0]?.count !== "0") throw new Error("La cuenta está referenciada por auditoría.");
        await trx.deleteFrom("users").where("id", "=", user.id).execute();
      } else throw new Error("Acción válida: review, deactivate o delete.");
    });
  } finally { await db.destroy(); }
}
main().catch(reportScriptError);
