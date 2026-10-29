import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { sql } from "kysely";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { Argon2HashService } from "../../../modules/identity/infrastructure/security/hash.service.js";
import { databaseTarget, reportScriptError, scriptDatabase } from "./script-database.js";

export function superadminOptions(args = process.argv.slice(2)) {
  try {
    return parseArgs({ args, options: {
      email: { type: "string" }, apply: { type: "boolean" },
    } }).values;
  } catch {
    // Do not echo unknown arguments: they may contain credentials.
    throw new Error("Opciones inválidas. Solo se admiten --email y --apply. Usa SUPERADMIN_PASSWORD para la contraseña.");
  }
}
async function main() {
  const values = superadminOptions();
  console.log("Destino:", databaseTarget());
  const email = z.string().email().parse(values.email ?? process.env.SUPERADMIN_EMAIL).trim().toLowerCase();
  if (!values.apply) { console.log("Comprobación de argumentos. Añade --apply para crear el SUPERADMIN indicado."); return; }
  // Do not print validation errors containing secret input.
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!password || password.length < 12 || password.length > 256)
    throw new Error("La contraseña requiere entre 12 y 256 caracteres; no se imprimirá.");
  const db = scriptDatabase();
  try {
    await db.transaction().execute(async (trx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 0))`.execute(trx);
      const existing = await trx.selectFrom("users").select(["id", "role"])
        .where(sql<string>`lower(email)`, "=", email).executeTakeFirst();
      if (existing) {
        if (existing.role !== "SUPERADMIN") throw new Error("Ese correo pertenece a TEACHER; no se modificó su rol.");
        console.log("SUPERADMIN ya existente; contraseña y estado conservados.");
        return;
      }
      const hash = await new Argon2HashService().hash(password);
      await trx.insertInto("users").values({ id: randomUUID(), email, password_hash: hash,
        role: "SUPERADMIN", is_active: true, must_change_password: false, token_version: 0 }).execute();
      console.log("SUPERADMIN creado sin perfil institucional ni billetera.");
    });
  } finally { await db.destroy(); }
}
if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()) {
  main().catch(reportScriptError);
}
