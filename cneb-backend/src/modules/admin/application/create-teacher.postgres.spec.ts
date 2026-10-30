import { createHash, randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { Kysely, PostgresDialect, sql, type Transaction } from "kysely";
import pg from "pg";
import type { DatabaseSchema, SubscriptionPlanEnum } from "../../../infrastructure/database/types.js";
import { applyMigrations, type MigrationSource } from "../../../infrastructure/database/scripts/migration-runner.js";
import { approvedStage2Target, loadStage2Migrations, requireStage2TestTarget, verifyStage1Migrations } from "../infrastructure/admin-postgres-test-support.js";
import { KyselyAdminUnitOfWork } from "../infrastructure/kysely-admin-unit-of-work.js";
import { Argon2HashService } from "../../identity/infrastructure/security/hash.service.js";
import { TemporaryCredentialService } from "../../identity/application/temporary-credential.service.js";
import { KyselyWalletRepository } from "../../billing/infrastructure/repositories/kysely-wallet.repository.js";
import type { AdminContext, IAdminUnitOfWork } from "../domain/admin.contracts.js";
import { teacherInput } from "./admin-test.fixture.js";
import { CreateTeacherUseCase } from "./create-teacher.use-case.js";

type Executor = Kysely<DatabaseSchema> | Transaction<DatabaseSchema>;
interface WalletOptions { plan?: string; unlimited?: boolean; expiresAt?: Date | null; }
interface Counts { users: number; profiles: number; wallets: number; audits: number; movements: number; }
interface MigrationHistory { name: string; checksum: string; applied_at: Date; }

// No dotenv, application singleton, DATABASE_URL fallback, pool or connection at import time.
describe.skipIf(process.env.CNEB_PG_TEST_APPLY !== "YES")("PostgreSQL Phase 2.2 (explicit opt-in, dedicated local database)", () => {
  const schema = "cneb_stage2_" + randomUUID().replaceAll("-", "");
  let control: Kysely<DatabaseSchema>;
  let db: Kysely<DatabaseSchema>;
  let created = false;
  let migrations: MigrationSource[];
  let appliedStage1: string[], appliedStage2: string[];
  let historicalQuarterly: string, historicalBimonthly: string;
  let context: AdminContext;
  let create: CreateTeacherUseCase;
  const hash = new Argon2HashService();

  async function insertUser(executor: Executor, userId: string, role: "TEACHER" | "SUPERADMIN" = "TEACHER",
    active = true, mustChange = false) {
    await executor.insertInto("users").values({ id: userId, email: userId + "@test.invalid",
      password_hash: "synthetic-fixture-not-a-password", role, is_active: active, must_change_password: mustChange }).execute();
  }
  async function insertProfile(executor: Executor, userId: string) {
    const profile = teacherInput().profile;
    await executor.insertInto("institutional_profiles").values({ user_id: userId,
      teacher_full_name: profile.teacherFullName, specialty: profile.specialty, school_name: profile.schoolName,
      ugel: profile.ugel, dre: profile.dre, principal_name: null, badge_url: null, signature_url: null }).execute();
  }
  async function insertWallet(executor: Executor, userId: string, options: WalletOptions = {}) {
    await executor.insertInto("credit_wallets").values({ user_id: userId, balance: 0,
      // Explicit SQL cast also permits seeding the old label before migration 010.
      plan_type: sql<SubscriptionPlanEnum>`${options.plan ?? "MONTHLY"}::subscription_plan`,
      is_unlimited: options.unlimited ?? false,
      expires_at: options.expiresAt === undefined ? new Date(Date.now() + 86400000) : options.expiresAt }).execute();
  }
  async function completeTeacher(options: WalletOptions = {}) {
    const userId = randomUUID();
    await db.transaction().execute(async (tx) => {
      await insertUser(tx, userId); await insertProfile(tx, userId); await insertWallet(tx, userId, options);
    });
    return userId;
  }
  async function counts(): Promise<Counts> {
    const result = await sql<Counts>`SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM institutional_profiles) AS profiles,
      (SELECT count(*)::int FROM credit_wallets) AS wallets,
      (SELECT count(*)::int FROM admin_audit_events) AS audits,
      (SELECT count(*)::int FROM wallet_transactions) AS movements`.execute(db);
    return result.rows[0]!;
  }
  function input(credits = 4) {
    return { ...teacherInput(), email: randomUUID() + "@test.invalid", initialCredits: credits,
      subscription: { ...teacherInput().subscription, expiresAt: new Date(Date.now() + 86400000).toISOString() } };
  }
  async function auditEvent(actorId = context.actor.userId, after: unknown = { safe: true }, before: unknown = null) {
    return db.insertInto("admin_audit_events").values({ id: randomUUID(), actor_user_id: actorId,
      actor_role: "SUPERADMIN", action: "TEST", entity_type: "TEACHER", entity_id: randomUUID(),
      reason: "Evento de prueba", before_data: before === null ? null : JSON.stringify(before), after_data: JSON.stringify(after), request_id: "pg-audit-test" })
      .returning("id").executeTakeFirstOrThrow();
  }

  beforeAll(async () => {
    // Every check runs before constructing a pool; no unconfirmed destination is contacted.
    const connectionString = requireStage2TestTarget({ url: process.env.CNEB_PG_TEST_DATABASE_URL,
      confirmed: process.env.CNEB_PG_TEST_CONFIRMED_TARGET, apply: process.env.CNEB_PG_TEST_APPLY });
    migrations = await loadStage2Migrations();
    console.log("PostgreSQL TEST destination:", approvedStage2Target, "isolated schema:", schema);
    control = new Kysely<DatabaseSchema>({ dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 }),
    }) });
    await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(control); created = true;
    db = new Kysely<DatabaseSchema>({ dialect: new PostgresDialect({ pool: new pg.Pool({
      connectionString, max: 6, connectionTimeoutMillis: 5000,
      options: "-c search_path=" + schema + ",public -c statement_timeout=15000 -c lock_timeout=10000",
    }) }) });
    expect((await sql<{ name: string }>`SELECT current_schema() AS name`.execute(db)).rows[0]?.name).toBe(schema);
    appliedStage1 = await db.connection().execute((connection) => applyMigrations(connection, migrations.slice(0, 7)));
    historicalQuarterly = await completeTeacher({ plan: "TRIMONTHLY" });
    historicalBimonthly = await completeTeacher({ plan: "BIMONTHLY", expiresAt: null });
    appliedStage2 = await db.connection().execute((connection) => applyMigrations(connection, migrations));
    const userId = randomUUID(), sessionId = randomUUID();
    await db.transaction().execute(async (tx) => {
      await insertUser(tx, userId, "SUPERADMIN");
      await tx.insertInto("auth_sessions").values({ id: sessionId, user_id: userId, revoked_at: null,
        expires_at: new Date(Date.now() + 86400000) }).execute();
    });
    context = { actor: { userId, sessionId, tokenVersion: 0 }, requestId: "pg-create-test" };
    create = new CreateTeacherUseCase(new KyselyAdminUnitOfWork(db), new TemporaryCredentialService(hash));
  }, 60000);
  afterAll(async () => {
    try { if (db) await db.destroy(); }
    finally {
      try {
        if (created && /^cneb_stage2_[a-f0-9]{32}$/.test(schema))
          await sql`DROP SCHEMA ${sql.id(schema)} CASCADE`.execute(control);
      } finally { if (control) await control.destroy(); }
    }
  }, 30000);

  it("applies 001–012 with checksums, preserves 001–007 and renames the existing quarterly label", async () => {
    expect(appliedStage1).toEqual(migrations.slice(0, 7).map((file) => file.name));
    expect(appliedStage2).toEqual(migrations.slice(7).map((file) => file.name));
    expect(() => verifyStage1Migrations(migrations)).not.toThrow();
    const history = (await sql<MigrationHistory>`SELECT name, checksum, applied_at FROM schema_migrations ORDER BY name`.execute(db)).rows;
    expect(history).toHaveLength(12);
    expect(history.map(({ name, checksum }) => ({ name, checksum }))).toEqual(migrations.map((file) => ({
      name: file.name, checksum: createHash("sha256").update(file.source).digest("hex"),
    })));
    const labels = (await sql<{ label: string }>`SELECT e.enumlabel AS label FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = ${schema} AND t.typname = 'subscription_plan' ORDER BY e.enumsortorder`.execute(db)).rows.map((row) => row.label);
    expect(labels).toEqual(["TRIAL", "MONTHLY", "BIMONTHLY", "QUARTERLY", "ANNUAL", "LIFETIME_FREE"]);
    expect((await db.selectFrom("credit_wallets").select("plan_type").where("user_id", "=", historicalQuarterly).executeTakeFirstOrThrow()).plan_type).toBe("QUARTERLY");
  });
  it("does not reapply migrations or alter ledger timestamps/catalog objects on a second execution", async () => {
    const ledger = () => sql<MigrationHistory>`SELECT name, checksum, applied_at FROM schema_migrations ORDER BY name`.execute(db);
    const catalog = () => sql<{ name: string; oid: number }>`SELECT c.relname AS name, c.oid::int AS oid
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = ${schema} ORDER BY c.relname`.execute(db);
    const before = await ledger(), objects = await catalog();
    expect(await db.connection().execute((connection) => applyMigrations(connection, migrations))).toEqual([]);
    expect((await ledger()).rows).toEqual(before.rows); expect((await catalog()).rows).toEqual(objects.rows);
    const tampered = migrations.map((file, index) => index === 7 ? { ...file, source: file.source + "\n-- altered" } : file);
    await expect(db.connection().execute((connection) => applyMigrations(connection, tampered))).rejects.toThrow("Migración aplicada modificada");
    expect((await ledger()).rows).toEqual(before.rows);
  });
  it("registers three enabled, unconditional, initially deferred constraint triggers bound to the expected functions", async () => {
    const expected = [
      { name: "users_teacher_composition", table_name: "users", function_name: "enforce_users_teacher_composition" },
      { name: "profiles_teacher_composition", table_name: "institutional_profiles", function_name: "enforce_profiles_teacher_composition" },
      { name: "wallets_teacher_composition", table_name: "credit_wallets", function_name: "enforce_wallets_teacher_composition" },
    ].sort((a, b) => a.name.localeCompare(b.name));
    interface TriggerMetadata {
      name: string; table_name: string; function_name: string; function_schema: string;
      deferrable: boolean; initially_deferred: boolean; enabled: string; internal: boolean;
      constraint_deferrable: boolean; constraint_initially_deferred: boolean;
      event_mask: number; unconditional: boolean; trigger_definition: string; function_definition: string;
    }
    const result = await sql<TriggerMetadata>`SELECT t.tgname AS name, r.relname AS table_name,
      p.proname AS function_name, pn.nspname AS function_schema,
      t.tgdeferrable AS deferrable, t.tginitdeferred AS initially_deferred,
      t.tgenabled AS enabled, t.tgisinternal AS internal, t.tgtype::int AS event_mask,
      t.tgqual IS NULL AS unconditional, c.condeferrable AS constraint_deferrable,
      c.condeferred AS constraint_initially_deferred,
      pg_get_triggerdef(t.oid) AS trigger_definition, pg_get_functiondef(p.oid) AS function_definition
      FROM pg_trigger t JOIN pg_class r ON r.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid JOIN pg_namespace pn ON pn.oid = p.pronamespace
      JOIN pg_constraint c ON c.oid = t.tgconstraint
      WHERE n.nspname = ${schema} AND t.tgname IN (
        'users_teacher_composition', 'profiles_teacher_composition', 'wallets_teacher_composition'
      ) ORDER BY t.tgname`.execute(db);
    expect(result.rows).toHaveLength(3);
    for (const [index, row] of result.rows.entries()) {
      expect(row).toMatchObject({ ...expected[index], function_schema: schema, deferrable: true,
        initially_deferred: true, enabled: "O", internal: false, event_mask: 29, unconditional: true,
        constraint_deferrable: true, constraint_initially_deferred: true });
      expect(row.trigger_definition).toContain("DEFERRABLE INITIALLY DEFERRED");
      expect(row.function_definition).toContain("enforce_teacher_composition_owners");
    }
    expect((await sql<{ mode: string }>`SELECT current_setting('session_replication_role') AS mode`.execute(db)).rows[0]?.mode).toBe("origin");
    const helper = await sql<{ definition: string }>`SELECT pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = ${schema} AND p.proname = 'enforce_teacher_composition' AND p.pronargs = 1`.execute(db);
    expect(helper.rows).toHaveLength(1);
    expect(helper.rows[0]?.definition).toContain("v_user_role");
    expect(helper.rows[0]?.definition).toContain("FOR UPDATE");
  });
  it("minimally reproduces the CURRENT_ROLE collision on an isolated diagnostic constraint trigger", async () => {
    // Reproduce the old expression only on a scratch table, never on application triggers.
    // All diagnostic DDL lives in this transaction and is removed before commit.
    await db.transaction().execute(async (tx) => {
      await sql`CREATE TABLE ${sql.id(schema, "composition_role_probe")} (
        id UUID PRIMARY KEY, app_role user_role NOT NULL, observed JSONB
      )`.execute(tx);
      await sql`CREATE FUNCTION ${sql.id(schema, "composition_role_probe_trigger")}() RETURNS trigger LANGUAGE plpgsql AS $$
        <<probe>>
        DECLARE current_role user_role;
        BEGIN
          SELECT NEW.app_role INTO current_role;
          UPDATE composition_role_probe SET observed = jsonb_build_object(
            'sql_role', current_role::text, 'local_role', probe.current_role::text,
            'teacher_branch', current_role = 'TEACHER', 'admin_branch', current_role = 'SUPERADMIN'
          ) WHERE id = NEW.id;
          IF (current_role = 'TEACHER' AND (0 <> 1 OR 0 <> 1))
            OR (current_role = 'SUPERADMIN' AND (1 <> 0 OR 1 <> 0)) THEN
            RAISE EXCEPTION 'The old expression unexpectedly enforced composition';
          END IF;
          RETURN NULL;
        END;
        $$`.execute(tx);
      await sql`CREATE CONSTRAINT TRIGGER composition_role_probe_constraint
        AFTER INSERT ON ${sql.id(schema, "composition_role_probe")}
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
        EXECUTE FUNCTION ${sql.id(schema, "composition_role_probe_trigger")}()`.execute(tx);
      const id = randomUUID();
      await sql`INSERT INTO ${sql.id(schema, "composition_role_probe")}(id, app_role) VALUES (${id}, 'TEACHER')`.execute(tx);
      await sql`SET CONSTRAINTS ALL IMMEDIATE`.execute(tx);
      const result = await sql<{ observed: { sql_role: string; local_role: string; teacher_branch: boolean; admin_branch: boolean } }>`
        SELECT observed FROM ${sql.id(schema, "composition_role_probe")} WHERE id = ${id}`.execute(tx);
      const sqlRole = (await sql<{ value: string }>`SELECT CURRENT_ROLE::text AS value`.execute(tx)).rows[0]!.value;
      expect(sqlRole).not.toMatch(/^(TEACHER|SUPERADMIN)$/);
      expect(result.rows[0]?.observed).toEqual({ sql_role: sqlRole, local_role: "TEACHER", teacher_branch: false, admin_branch: false });
      await sql`DROP TABLE ${sql.id(schema, "composition_role_probe")}`.execute(tx);
      await sql`DROP FUNCTION ${sql.id(schema, "composition_role_probe_trigger")}()`.execute(tx);
    });
  });
  it.each(["missing profile", "missing wallet", "SUPERADMIN profile", "SUPERADMIN wallet", "delete profile", "delete wallet"] as const)(
    "forces the corrected validation at SET CONSTRAINTS ALL IMMEDIATE: %s", async (scenario) => {
      const deleting = scenario.startsWith("delete");
      const id = deleting ? await completeTeacher() : randomUUID();
      const before = await counts(); let reachedCheckpoint = false, passedCheckpoint = false;
      await expect(db.transaction().execute(async (tx) => {
        if (deleting) {
          const table = scenario === "delete profile" ? "institutional_profiles" : "credit_wallets";
          await tx.deleteFrom(table).where("user_id", "=", id).execute();
        } else if (scenario.startsWith("SUPERADMIN")) {
          await insertUser(tx, id, "SUPERADMIN");
          if (scenario === "SUPERADMIN profile") await insertProfile(tx, id); else await insertWallet(tx, id);
        } else {
          await insertUser(tx, id);
          if (scenario === "missing profile") await insertWallet(tx, id); else await insertProfile(tx, id);
        }
        reachedCheckpoint = true;
        await sql`SET CONSTRAINTS ALL IMMEDIATE`.execute(tx);
        passedCheckpoint = true;
      })).rejects.toMatchObject({ code: "P0001" });
      expect(reachedCheckpoint).toBe(true); expect(passedCheckpoint).toBe(false);
      expect(await counts()).toEqual(before);
      expect(await db.selectFrom("users").select("id").where("id", "=", id).execute()).toHaveLength(deleting ? 1 : 0);
    },
  );
  it("accepts a complete atomic teacher when deferred constraints are forced before commit", async () => {
    const id = randomUUID(), before = await counts(); let validated = false;
    await db.transaction().execute(async (tx) => {
      await insertUser(tx, id); await insertProfile(tx, id); await insertWallet(tx, id);
      await sql`SET CONSTRAINTS ALL IMMEDIATE`.execute(tx); validated = true;
    });
    expect(validated).toBe(true);
    expect(await counts()).toEqual({ ...before, users: before.users + 1, profiles: before.profiles + 1, wallets: before.wallets + 1 });
  });
  it("allows deletion of an unreferenced teacher and its dependent rows through FK cascades", async () => {
    const id = await completeTeacher(), sid = randomUUID();
    await db.insertInto("auth_sessions").values({ id: sid, user_id: id, revoked_at: null, expires_at: new Date(Date.now() + 86400000) }).execute();
    const before = await counts();
    await db.transaction().execute(async (tx) => {
      await tx.deleteFrom("users").where("id", "=", id).execute();
      await sql`SET CONSTRAINTS ALL IMMEDIATE`.execute(tx);
    });
    expect(await counts()).toEqual({ ...before, users: before.users - 1, profiles: before.profiles - 1, wallets: before.wallets - 1 });
    expect(await db.selectFrom("users").select("id").where("id", "=", id).execute()).toHaveLength(0);
    expect(await db.selectFrom("auth_sessions").select("id").where("id", "=", sid).execute()).toHaveLength(0);
  });
  it.each(["institutional_profiles", "credit_wallets"] as const)("checks the previous owner when reassigning %s", async (table) => {
    const source = await completeTeacher(), target = await completeTeacher(), before = await counts();
    const previous = await db.selectFrom(table).select(["id", "user_id"]).where("user_id", "in", [source, target]).orderBy("id").execute();
    await expect(db.transaction().execute(async (tx) => {
      await tx.deleteFrom(table).where("user_id", "=", target).execute();
      await tx.updateTable(table).set({ user_id: target }).where("user_id", "=", source).execute();
      // Target is complete again; only the former owner remains invalid at commit.
    })).rejects.toMatchObject({ code: "P0001" });
    expect(await counts()).toEqual(before);
    expect(await db.selectFrom(table).select(["id", "user_id"]).where("user_id", "in", [source, target]).orderBy("id").execute()).toEqual(previous);
  });
  it.each(["institutional_profiles", "credit_wallets"] as const)("checks the new owner even if the previous owner was deleted: %s", async (table) => {
    const source = await completeTeacher(), target = randomUUID();
    await insertUser(db, target, "SUPERADMIN");
    const before = await counts();
    await expect(db.transaction().execute(async (tx) => {
      await tx.updateTable(table).set({ user_id: target }).where("user_id", "=", source).execute();
      await tx.deleteFrom("users").where("id", "=", source).execute();
      // Former owner and remaining cascades are gone; the SUPERADMIN alone is invalid.
    })).rejects.toMatchObject({ code: "P0001" });
    expect(await counts()).toEqual(before);
    expect(await db.selectFrom(table).select("id").where("user_id", "=", source).execute()).toHaveLength(1);
    expect(await db.selectFrom(table).select("id").where("user_id", "=", target).execute()).toHaveLength(0);
  });
  it.each(["institutional_profiles", "credit_wallets"] as const)("permits a final-state-valid reassignment of %s between two teachers", async (table) => {
    const source = await completeTeacher(), target = await completeTeacher(), before = await counts();
    const original = await db.selectFrom(table).select("id").where("user_id", "=", source).executeTakeFirstOrThrow();
    await db.transaction().execute(async (tx) => {
      await tx.deleteFrom(table).where("user_id", "=", target).execute();
      await tx.updateTable(table).set({ user_id: target }).where("user_id", "=", source).execute();
      if (table === "institutional_profiles") await insertProfile(tx, source); else await insertWallet(tx, source);
      await sql`SET CONSTRAINTS ALL IMMEDIATE`.execute(tx);
    });
    expect(await counts()).toEqual(before);
    expect((await db.selectFrom(table).select("id").where("user_id", "=", target).executeTakeFirstOrThrow()).id).toBe(original.id);
    expect(await db.selectFrom(table).select("id").where("user_id", "=", source).execute()).toHaveLength(1);
  });
  it("revalidates composition on role changes without retaining failed token-version changes", async () => {
    const teacher = await completeTeacher(), admin = randomUUID();
    await insertUser(db, admin, "SUPERADMIN");
    const before = await db.selectFrom("users").select(["id", "role", "token_version"]).where("id", "in", [teacher, admin]).orderBy("id").execute();
    for (const [id, role] of [[teacher, "SUPERADMIN"], [admin, "TEACHER"]] as const) {
      await expect(db.transaction().execute(async (tx) => {
        await tx.updateTable("users").set({ role }).where("id", "=", id).execute();
      })).rejects.toMatchObject({ code: "P0001" });
    }
    expect(await db.selectFrom("users").select(["id", "role", "token_version"]).where("id", "in", [teacher, admin]).orderBy("id").execute()).toEqual(before);
  });
  it("commits one complete TEACHER with exactly one profile and wallet", async () => {
    const id = await completeTeacher();
    expect(await db.selectFrom("users").select("id").where("id", "=", id).execute()).toHaveLength(1);
    expect(await db.selectFrom("institutional_profiles").select("id").where("user_id", "=", id).execute()).toHaveLength(1);
    expect(await db.selectFrom("credit_wallets").select("id").where("user_id", "=", id).execute()).toHaveLength(1);
    await expect(insertProfile(db, id)).rejects.toMatchObject({ code: "23505" });
    await expect(insertWallet(db, id)).rejects.toMatchObject({ code: "23505" });
  });
  it.each(["profile", "wallet"] as const)("rejects a missing %s at commit and rolls back all rows", async (missing) => {
    const before = await counts(), id = randomUUID(); let completed = false;
    await expect(db.transaction().execute(async (tx) => {
      await insertUser(tx, id);
      if (missing !== "profile") await insertProfile(tx, id);
      if (missing !== "wallet") await insertWallet(tx, id);
      completed = true;
    })).rejects.toMatchObject({ code: "P0001" });
    expect(completed).toBe(true); expect(await counts()).toEqual(before);
  });
  it.each(["profile", "wallet"] as const)("rejects SUPERADMIN with %s at commit", async (child) => {
    const before = await counts(), id = randomUUID(); let completed = false;
    await expect(db.transaction().execute(async (tx) => {
      await insertUser(tx, id, "SUPERADMIN");
      if (child === "profile") await insertProfile(tx, id); else await insertWallet(tx, id);
      completed = true;
    })).rejects.toMatchObject({ code: "P0001" });
    expect(completed).toBe(true); expect(await counts()).toEqual(before);
  });
  it.each(["institutional_profiles", "credit_wallets"] as const)("protects dependency deletion and TRUNCATE of %s", async (table) => {
    const id = await completeTeacher(), before = await counts();
    await expect(db.transaction().execute(async (tx) => {
      await tx.deleteFrom(table).where("user_id", "=", id).execute();
    })).rejects.toMatchObject({ code: "P0001" });
    await expect(sql`TRUNCATE TABLE ${sql.id(table)} CASCADE`.execute(db)).rejects.toMatchObject({ code: "P0001" });
    expect(await counts()).toEqual(before);
  });
  it("keeps BIMONTHLY historical wallets readable but rejects new assignments", async () => {
    expect((await new KyselyWalletRepository(db).findByUserId(historicalBimonthly))?.planType).toBe("BIMONTHLY");
    const before = await counts();
    await expect(completeTeacher({ plan: "BIMONTHLY" })).rejects.toMatchObject({ code: "P0001" });
    expect(await counts()).toEqual(before);
    const id = await completeTeacher();
    await expect(db.updateTable("credit_wallets").set({ plan_type: "BIMONTHLY" }).where("user_id", "=", id).execute())
      .rejects.toMatchObject({ code: "P0001" });
  });
  it.each(["TRIAL", "MONTHLY", "QUARTERLY", "ANNUAL"])("enforces expiry and non-unlimited for %s in PostgreSQL", async (plan) => {
    const before = await counts();
    await expect(completeTeacher({ plan, expiresAt: null })).rejects.toMatchObject({ code: "23514" });
    await expect(completeTeacher({ plan, unlimited: true })).rejects.toMatchObject({ code: "23514" });
    expect(await counts()).toEqual(before);
    expect(await completeTeacher({ plan })).toEqual(expect.any(String));
  });
  it("accepts only coherent LIFETIME_FREE configuration", async () => {
    const before = await counts();
    await expect(completeTeacher({ plan: "LIFETIME_FREE", unlimited: false, expiresAt: null })).rejects.toMatchObject({ code: "23514" });
    await expect(completeTeacher({ plan: "LIFETIME_FREE", unlimited: true })).rejects.toMatchObject({ code: "23514" });
    expect(await counts()).toEqual(before);
    const id = await completeTeacher({ plan: "LIFETIME_FREE", unlimited: true, expiresAt: null });
    expect((await new KyselyWalletRepository(db).findByUserId(id))?.canGenerateSession()).toBe(true);
  });
  it.each([0, 5])("atomically commits administrative creation with %s initial credits and safe audit", async (credits) => {
    const before = await counts();
    const requestContext = { ...context, accessToken: "synthetic-access-" + randomUUID(),
      refreshToken: "synthetic-refresh-" + randomUUID(), cookie: "refreshToken=synthetic-cookie-" + randomUUID() };
    const request = { ...input(credits), temporaryPassword: " Provided secret " + randomUUID() + " " };
    const result = await create.execute(request, requestContext);
    expect(result.temporaryPassword === request.temporaryPassword).toBe(true);
    expect(await counts()).toEqual({ users: before.users + 1, profiles: before.profiles + 1,
      wallets: before.wallets + 1, audits: before.audits + 1, movements: before.movements + (credits > 0 ? 1 : 0) });
    const user = await db.selectFrom("users").select(["password_hash", "must_change_password"]).where("id", "=", result.user.id).executeTakeFirstOrThrow();
    expect(user.must_change_password).toBe(true); expect(await hash.compare(request.temporaryPassword, user.password_hash)).toBe(true);
    const profile = await db.selectFrom("institutional_profiles").select(["id", "teacher_full_name", "school_name"])
      .where("user_id", "=", result.user.id).executeTakeFirstOrThrow();
    const wallet = await db.selectFrom("credit_wallets").select(["id", "balance", "plan_type", "is_unlimited", "expires_at"])
      .where("user_id", "=", result.user.id).executeTakeFirstOrThrow();
    expect(profile).toMatchObject({ id: result.profile.id, teacher_full_name: request.profile.teacherFullName, school_name: request.profile.schoolName });
    expect(wallet).toEqual({ id: result.wallet.id, balance: credits, plan_type: "MONTHLY", is_unlimited: false,
      expires_at: new Date(request.subscription.expiresAt!) });
    const event = await db.selectFrom("admin_audit_events").selectAll().where("entity_id", "=", result.user.id).executeTakeFirstOrThrow();
    expect(event).toMatchObject({ actor_user_id: context.actor.userId, actor_role: "SUPERADMIN", action: "TEACHER_CREATED",
      reason: request.reason, before_data: null, request_id: context.requestId });
    expect(event.created_at).toBeInstanceOf(Date);
    expect(event.after_data).toEqual({ user: result.user, profile: result.profile, wallet: result.wallet });
    const serialized = JSON.stringify(event);
    for (const secret of [request.temporaryPassword, user.password_hash, context.actor.sessionId,
      requestContext.accessToken, requestContext.refreshToken, requestContext.cookie]) expect(serialized.includes(secret)).toBe(false);
    expect(serialized).not.toMatch(/password_hash|passwordHash|temporaryPassword|accessToken|refreshToken|cookie|"sid"/);
    const movements = await db.selectFrom("wallet_transactions").selectAll().where("wallet_id", "=", result.wallet.id).execute();
    expect(movements).toHaveLength(credits > 0 ? 1 : 0);
    if (credits > 0) expect(movements[0]).toMatchObject({ transaction_type: "ADMIN_MANUAL_ADJUSTMENT", amount: credits,
      actor_user_id: context.actor.userId, balance_before: 0, balance_after: credits, note: request.reason,
      admin_audit_event_id: event.id, plan_type_before: "MONTHLY", plan_type_after: "MONTHLY" });
  });
  it.each(["admin_audit_events", "wallet_transactions"] as const)("rolls back all creation records when %s insertion fails", async (table) => {
    const before = await counts();
    await sql`CREATE FUNCTION ${sql.id(schema, "reject_admin_insert")}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'injected administrative persistence failure'; END; $$`.execute(db);
    await sql`CREATE TRIGGER reject_admin_insert BEFORE INSERT ON ${sql.id(table)}
      FOR EACH ROW EXECUTE FUNCTION ${sql.id(schema, "reject_admin_insert")}()`.execute(db);
    try {
      await expect(create.execute(input(), context)).rejects.toMatchObject({ code: "P0001" });
      expect(await counts()).toEqual(before);
    } finally {
      await sql`DROP TRIGGER reject_admin_insert ON ${sql.id(table)}`.execute(db);
      await sql`DROP FUNCTION ${sql.id(schema, "reject_admin_insert")}()`.execute(db);
    }
  });
  it("serializes equivalent concurrent emails into one complete account and a safe 409", async () => {
    const before = await counts(), request = input();
    // Hold the first transaction until PostgreSQL reports the second connection blocked by it.
    let arrived!: () => void, release!: () => void;
    const inserted = new Promise<void>((resolve) => { arrived = resolve; });
    const unlocked = new Promise<void>((resolve) => { release = resolve; });
    let firstPid = 0, secondPid = 0;
    const first = db.connection().execute(async (connection) => {
      firstPid = (await sql<{ pid: number }>`SELECT pg_backend_pid() AS pid`.execute(connection)).rows[0]!.pid;
      const work = new KyselyAdminUnitOfWork(connection);
      const blockingWork: IAdminUnitOfWork = { execute: (operation) => work.execute(async (tx) => {
        const original = tx.teachers.insertUser.bind(tx.teachers);
        tx.teachers.insertUser = async (user, passwordHash) => { await original(user, passwordHash); arrived(); await unlocked; };
        return operation(tx);
      }) };
      return new CreateTeacherUseCase(blockingWork, new TemporaryCredentialService(hash)).execute(request, context);
    });
    let second: ReturnType<CreateTeacherUseCase["execute"]> | undefined;
    try {
      await Promise.race([inserted, first.then(() => { throw new Error("First transaction did not reach the insertion barrier"); })]);
      second = db.connection().execute(async (connection) => {
        secondPid = (await sql<{ pid: number }>`SELECT pg_backend_pid() AS pid`.execute(connection)).rows[0]!.pid;
        return new CreateTeacherUseCase(new KyselyAdminUnitOfWork(connection), new TemporaryCredentialService(hash))
          .execute({ ...request, email: "  " + request.email.toUpperCase() + "  " }, context);
      });
      const settled = Promise.allSettled([first, second]);
      let observedBlocking = false;
      for (let attempt = 0; attempt < 100 && !observedBlocking; attempt++) {
        if (secondPid) observedBlocking = (await sql<{ blocked: boolean }>`SELECT ${firstPid} = ANY(pg_blocking_pids(${secondPid})) AS blocked`
          .execute(db)).rows[0]!.blocked;
        if (!observedBlocking) await new Promise<void>((resolve) => setTimeout(resolve, 50));
      }
      release();
      const outcomes = await settled;
      expect(observedBlocking).toBe(true);
      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      const rejected = outcomes.find((outcome) => outcome.status === "rejected");
      expect(rejected?.status === "rejected" && rejected.reason.statusCode === 409).toBe(true);
      if (rejected?.status === "rejected") {
        expect(rejected.reason.message).toBe("El correo ya está registrado.");
        expect(JSON.stringify(rejected.reason)).not.toMatch(/password|hash|23505|constraint|detail|query|parameters/);
      }
      expect(await counts()).toEqual({ users: before.users + 1, profiles: before.profiles + 1,
        wallets: before.wallets + 1, audits: before.audits + 1, movements: before.movements + 1 });
      expect(await db.selectFrom("users").select("email").where("email", "=", request.email).execute()).toHaveLength(1);
    } finally { release(); await Promise.allSettled(second ? [first, second] : [first]); }
  }, 30000);
  it("requires an active SUPERADMIN without mandatory password change for audit insertion", async () => {
    const teacher = await completeTeacher();
    const inactive = randomUUID(), restricted = randomUUID();
    await insertUser(db, inactive, "SUPERADMIN", false);
    await insertUser(db, restricted, "SUPERADMIN", true, true);
    const before = await counts();
    for (const actorId of [teacher, inactive, restricted]) await expect(auditEvent(actorId)).rejects.toMatchObject({ code: "P0001" });
    expect(await counts()).toEqual(before);
    expect((await auditEvent()).id).toEqual(expect.any(String));
  });
  it("protects administrative audit from UPDATE, DELETE and TRUNCATE", async () => {
    const { id } = await auditEvent(), before = await counts();
    await expect(db.updateTable("admin_audit_events").set({ reason: "Motivo alterado" }).where("id", "=", id).execute()).rejects.toMatchObject({ code: "P0001" });
    await expect(db.deleteFrom("admin_audit_events").where("id", "=", id).execute()).rejects.toMatchObject({ code: "P0001" });
    await expect(sql`TRUNCATE TABLE admin_audit_events CASCADE`.execute(db)).rejects.toMatchObject({ code: "P0001" });
    expect(await counts()).toEqual(before);
    expect((await db.selectFrom("admin_audit_events").select("reason").where("id", "=", id).executeTakeFirstOrThrow()).reason).toBe("Evento de prueba");
  });
  it.each(["password", "password_hash", "temporaryPassword", "current_password", "newPassword", "access_token",
    "refreshToken", "jwt", "cookie", "cookies", "authorization", "sid"])("rejects nested credential key %s in audit JSON", async (key) => {
    const before = await counts();
    const document = { nested: [{ [key]: "synthetic-secret" }] };
    await expect(auditEvent(context.actor.userId, document)).rejects.toMatchObject({ code: "23514" });
    await expect(auditEvent(context.actor.userId, {}, document)).rejects.toMatchObject({ code: "23514" });
    expect(await counts()).toEqual(before);
  });
});
