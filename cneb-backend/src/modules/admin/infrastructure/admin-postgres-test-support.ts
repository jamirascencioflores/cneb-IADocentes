import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import type { MigrationSource } from "../../../infrastructure/database/scripts/migration-runner.js";

export const approvedStage2Target = "postgresql://127.0.0.1:5432/cneb_stage1_test_20261029";
export function requireStage2TestTarget(input: { url?: string | undefined; confirmed?: string | undefined; apply?: string | undefined }): string {
  if (input.apply !== "YES" || !input.url || input.confirmed !== approvedStage2Target)
    throw new Error("Se requieren URL de pruebas, destino aprobado y CNEB_PG_TEST_APPLY=YES.");
  let url: URL;
  try { url = new URL(input.url); } catch { throw new Error("URL de pruebas inválida; credenciales ocultas."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1"
    || url.port !== "5432" || url.pathname !== "/cneb_stage1_test_20261029" || url.search || url.hash)
    throw new Error("Solo se admite la base local exclusiva aprobada, sin opciones de conexión adicionales.");
  return input.url;
}
// Canonical LF SHA-256 of the seven files in approved Stage 1 commit 069f77e.
export const stage1MigrationHashes: Readonly<Record<string, string>> = {
  "001_initial_schema.sql": "bb963473fe25d3e093fdd68fc4e011c153255f220c0de8eb117da8834dc0632d",
  "002_identity_security.sql": "7612ea5e05d7267462fec2d81656fa42d1d829488599e613b7f3bf2eba024fc3",
  "003_institutional_profile_unique.sql": "132ca1d42f4d4059b55f4bca3a18d23c8a255b748e52171aab3eaaed5942caa9",
  "004_wallet_audit.sql": "947b7634714fce30cfc77ae2217f5bd0a9d288230de8eaef03a34753ad80c89d",
  "005_generation_idempotency.sql": "e2d4b955e3bef8ee68897e13a3a9a4b29c40ef91335fa7c4a7d2e8cbba721d03",
  "006_generation_accounting.sql": "7683946f1b40d256c0b1fc98a09f2ae5d80d4e63cc3a4dfd456699af37d06a77",
  "007_session_institutional_snapshot.sql": "11402a6446f77372ba6205896de839acf0c799808e1c288536dfd64dcfcff5c8",
};
export function verifyStage1Migrations(migrations: readonly MigrationSource[]) {
  for (const [name, expected] of Object.entries(stage1MigrationHashes)) {
    const migration = migrations.find((entry) => entry.name === name);
    if (!migration || createHash("sha256").update(migration.source.replace(/\r\n/g, "\n")).digest("hex") !== expected)
      throw new Error("Migración de Etapa 1 modificada o ausente: " + name);
  }
}
export async function loadStage2Migrations(): Promise<MigrationSource[]> {
  const directory = new URL("../../../infrastructure/database/migrations/", import.meta.url);
  const files = (await fs.readdir(directory)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
  if (files.length !== 12 || files.some((name, index) => !name.startsWith(String(index + 1).padStart(3, "0") + "_")))
    throw new Error("La suite de Fase 2.2 exige exactamente la cadena 001–012.");
  const migrations = await Promise.all(files.map(async (name) => ({ name, source: await fs.readFile(new URL(name, directory), "utf8") })));
  verifyStage1Migrations(migrations);
  return migrations;
}
