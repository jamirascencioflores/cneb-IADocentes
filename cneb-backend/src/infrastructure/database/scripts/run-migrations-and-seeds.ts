import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "kysely";
import { db } from "../database.js"; // Verifica la ruta a tu instancia de Kysely

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("🚀 Iniciando configuración de base de datos CNEB...");

  const migrationPath = path.resolve(
    __dirname,
    "../migrations/001_initial_schema.sql",
  );
  const seedPath = path.resolve(__dirname, "../seeds/cneb_seeds.sql");

  try {
    // 1. Ejecutar Migración Inicial
    console.log("📦 Ejecutando 001_initial_schema.sql...");
    const migrationSql = await fs.readFile(migrationPath, "utf-8");
    await sql.raw(migrationSql).execute(db);
    console.log("✅ Esquema y tablas creados exitosamente.");

    // 2. Ejecutar Seeds Oficiales CNEB
    console.log("🌱 Ejecutando cneb_seeds.sql...");
    const seedSql = await fs.readFile(seedPath, "utf-8");
    await sql.raw(seedSql).execute(db);
    console.log(
      "✅ Catálogo CNEB (Áreas, Competencias, Capacidades, Desempeños) poblado exitosamente.",
    );

    console.log("🎉 Base de datos lista para pruebas y consumo del Frontend.");
  } catch (error) {
    console.error("❌ Error durante la ejecución:", error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
