import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import type { DatabaseSchema } from "../../../infrastructure/database/types.js";
import { GenerateSessionUseCase } from "./generate-session.use-case.js";
import { PreviewSessionUseCase } from "./preview-session.use-case.js";
import { generationFixture, generationInput, institutionalFixture, authFixture } from "./generation-test.fixture.js";

// Never falls back to DATABASE_URL. Requires an explicitly approved, dedicated test database.
const target = process.env.CNEB_PG_TEST_DATABASE_URL;
const enabled = !!target && process.env.CNEB_PG_TEST_APPLY === "YES";
function safeTarget(value: string) {
  const url = new URL(value);
  return url.protocol + "//" + url.hostname + ":" + (url.port || "5432") + url.pathname;
}
describe.skipIf(!enabled)("PostgreSQL stage 1 isolation and transactions (explicit opt-in)", () => {
  const schema = "cneb_stage1_" + randomUUID().replaceAll("-", "");
  let control: Kysely<DatabaseSchema>;
  let db: Kysely<DatabaseSchema>;
  let created = false;
  beforeAll(async () => {
    const destination = safeTarget(target!);
    console.log("PostgreSQL TEST destination:", destination, "isolated schema:", schema);
    if (process.env.CNEB_PG_TEST_CONFIRMED_TARGET !== destination)
      throw new Error("Explicit destination confirmation is required before connecting.");
    control = new Kysely<DatabaseSchema>({ dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: target, max: 1 }),
    }) });
    await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(control);
    created = true;
    db = new Kysely<DatabaseSchema>({ dialect: new PostgresDialect({ pool: new pg.Pool({
      connectionString: target, max: 6, options: "-c search_path=" + schema + ",public",
    }) }) });
    const directory = new URL("../../../infrastructure/database/migrations/", import.meta.url);
    for (const file of (await fs.readdir(directory)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort()) {
      const source = await fs.readFile(new URL(file, directory), "utf8");
      await db.transaction().execute(async (trx) => { await sql.raw(source).execute(trx); });
    }
    await db.insertInto("areas").values({ id: "COM", name: "Comunicación" }).execute();
    await db.insertInto("competencies").values({ id: "COM_C01", area_id: "COM", title: "Competencia", description: "Descripción" }).execute();
    await db.insertInto("performances").values({ id: "PERF", competency_id: "COM_C01", grade_level: "THIRD", standard_description: "Desempeño" }).execute();
  }, 30000);
  afterAll(async () => {
    if (db) await db.destroy();
    if (created && /^cneb_stage1_[a-f0-9]{32}$/.test(schema))
      await sql`DROP SCHEMA ${sql.id(schema)} CASCADE`.execute(control);
    if (control) await control.destroy();
  });
  async function fixture(balance = 1, unlimited = false) {
    const userId = randomUUID(), sid = randomUUID(), walletId = randomUUID();
    await db.transaction().execute(async (trx) => {
      await trx.insertInto("users").values({ id: userId, email: userId + "@test.invalid",
        password_hash: "test-hash-not-a-credential", role: "TEACHER", is_active: true }).execute();
      await trx.insertInto("auth_sessions").values({ id: sid, user_id: userId,
        revoked_at: null, expires_at: new Date(Date.now() + 86400000) }).execute();
      await trx.insertInto("institutional_profiles").values({ user_id: userId,
        teacher_full_name: institutionalFixture.teacherFullName, specialty: institutionalFixture.specialty,
        school_name: institutionalFixture.schoolName, ugel: institutionalFixture.ugel, dre: institutionalFixture.dre,
        principal_name: null, badge_url: null, signature_url: null }).execute();
      await trx.insertInto("credit_wallets").values({ id: walletId, user_id: userId, balance,
        is_unlimited: unlimited, plan_type: unlimited ? "LIFETIME_FREE" : "MONTHLY",
        expires_at: unlimited ? null : new Date(Date.now() + 86400000) }).execute();
    });
    const auth = { ...authFixture, sub: userId, sid };
    const preview = { execute: vi.fn().mockResolvedValue(generationFixture) };
    const useCase = new GenerateSessionUseCase(db, preview as unknown as PreviewSessionUseCase);
    return { auth, preview, useCase, walletId };
  }
  async function counts(userId: string, walletId: string) {
    const sessions = await db.selectFrom("learning_sessions").selectAll().where("user_id", "=", userId).execute();
    const movements = await db.selectFrom("wallet_transactions").selectAll().where("wallet_id", "=", walletId).execute();
    const wallet = await db.selectFrom("credit_wallets").selectAll().where("id", "=", walletId).executeTakeFirstOrThrow();
    return { sessions, movements, wallet };
  }
  it("two distinct requests with balance one commit exactly one session and debit", async () => {
    const { auth, preview, useCase, walletId } = await fixture();
    let entered = 0;
    let release!: () => void;
    const bothAtGemini = new Promise<void>((resolve) => { release = resolve; });
    preview.execute.mockImplementation(async () => { if (++entered === 2) release(); await bothAtGemini; return generationFixture; });
    const results = await Promise.allSettled([
      useCase.execute(auth, "one", generationInput), useCase.execute(auth, "two", generationInput),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const result = await counts(auth.sub, walletId);
    expect(result.wallet.balance).toBe(0);
    expect(result.sessions).toHaveLength(1);
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0]?.amount).toBe(-1);
  });
  it("same-key concurrency calls Gemini once, and a lost response replays the committed result", async () => {
    const { auth, preview, useCase, walletId } = await fixture();
    const requests = await Promise.allSettled([
      useCase.execute(auth, "same", generationInput), useCase.execute(auth, "same", generationInput),
    ]);
    expect(requests.some((result) => result.status === "fulfilled")).toBe(true);
    const replay = await useCase.execute(auth, "same", generationInput);
    expect(replay.id).toBeTruthy();
    expect(preview.execute).toHaveBeenCalledTimes(1);
    const result = await counts(auth.sub, walletId);
    expect(result.sessions).toHaveLength(1);
    expect(result.movements).toHaveLength(1);
    await expect(useCase.execute(auth, "same", { ...generationInput, sessionTitle: "Otro título" })).rejects.toMatchObject({ statusCode: 409 });
  });
  it("a PostgreSQL relationship failure rolls back the session, credit and movement together", async () => {
    const { auth, useCase, walletId } = await fixture();
    // Real FK failure during instrument persistence, after the parent session INSERT.
    await sql`CREATE FUNCTION ${sql.id(schema, "reject_criterion")}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'simulated criterion persistence failure'; END; $$`.execute(db);
    await sql`CREATE TRIGGER fail_criterion BEFORE INSERT ON evaluation_criteria FOR EACH ROW
      EXECUTE FUNCTION ${sql.id(schema, "reject_criterion")}()`.execute(db);
    try {
      await expect(useCase.execute(auth, "fail", generationInput)).rejects.toThrow();
      const result = await counts(auth.sub, walletId);
      expect(result.wallet.balance).toBe(1);
      expect(result.sessions).toHaveLength(0);
      expect(result.movements).toHaveLength(0);
    } finally {
      await sql`DROP TRIGGER fail_criterion ON evaluation_criteria`.execute(db);
      await sql`DROP FUNCTION ${sql.id(schema, "reject_criterion")}()`.execute(db);
    }
  });
  it("keeps snapshots immutable when the administrator corrects the current profile", async () => {
    const { auth, useCase } = await fixture();
    const session = await useCase.execute(auth, "identity", generationInput);
    await db.updateTable("institutional_profiles").set({ teacher_full_name: "Nombre corregido" }).where("user_id", "=", auth.sub).execute();
    const persisted = await db.selectFrom("learning_sessions").select("institutional_snapshot")
      .where("id", "=", session.id).executeTakeFirstOrThrow();
    expect(persisted.institutional_snapshot).toEqual(institutionalFixture);
    await expect(db.updateTable("learning_sessions").set({ institutional_snapshot: JSON.stringify({ ...institutionalFixture, teacherFullName: "Reemplazado" }) })
      .where("id", "=", session.id).execute()).rejects.toThrow(/immutable/);
  });
  it("audits unlimited generation without a credit movement", async () => {
    const { auth, useCase, walletId } = await fixture(0, true);
    await useCase.execute(auth, "free", generationInput);
    const result = await counts(auth.sub, walletId);
    expect(result.wallet.balance).toBe(0);
    expect(result.sessions).toHaveLength(1);
    expect(result.movements).toHaveLength(0);
    const request = await db.selectFrom("generation_requests").select("status").where("user_id", "=", auth.sub).executeTakeFirstOrThrow();
    expect(request.status).toBe("COMPLETED");
  });
  it("increments token_version on disable and never restores it on reactivation", async () => {
    const { auth } = await fixture();
    await db.updateTable("users").set({ is_active: false }).where("id", "=", auth.sub).execute();
    await db.updateTable("users").set({ is_active: true }).where("id", "=", auth.sub).execute();
    const user = await db.selectFrom("users").select("token_version").where("id", "=", auth.sub).executeTakeFirstOrThrow();
    expect(user.token_version).toBe(1);
  });
});
