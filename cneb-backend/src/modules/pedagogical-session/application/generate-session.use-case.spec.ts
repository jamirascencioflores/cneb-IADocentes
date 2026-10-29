import { beforeEach, describe, expect, it, vi } from "vitest";
// These are orchestration tests. PostgreSQL locking is covered by the opt-in integration suite.
vi.mock("kysely", async (original) => ({ ...await original<typeof import("kysely")>(),
  sql: () => ({ execute: async () => ({ rows: [] }) }),
}));
import { GenerateSessionUseCase } from "./generate-session.use-case.js";
import { generateSessionSchema } from "../controllers/session.schemas.js";
import type { PreviewSessionUseCase } from "./preview-session.use-case.js";
import { generationFixture, generationInput, institutionalFixture, authFixture } from "./generation-test.fixture.js";

function memoryDatabase() {
  let tables: Record<string, any[]> = {
    users: [{ id: authFixture.sub, role: "TEACHER", is_active: true, token_version: 0, must_change_password: false }],
    auth_sessions: [{ id: authFixture.sid, user_id: authFixture.sub, revoked_at: null, expires_at: new Date(Date.now() + 86400000) }],
    institutional_profiles: [{ id: "profile", user_id: authFixture.sub, teacher_full_name: institutionalFixture.teacherFullName,
      specialty: institutionalFixture.specialty, school_name: institutionalFixture.schoolName,
      ugel: institutionalFixture.ugel, dre: institutionalFixture.dre,
      principal_name: null, badge_url: null, signature_url: null }],
    credit_wallets: [{ id: "wallet", user_id: authFixture.sub, balance: 2, plan_type: "MONTHLY",
      is_unlimited: false, expires_at: new Date(Date.now() + 86400000), starts_at: new Date(),
      created_at: new Date(), updated_at: new Date() }],
    generation_requests: [], learning_sessions: [], wallet_transactions: [],
    session_competencies: [], session_moments: [], evaluation_instruments: [], evaluation_criteria: [],
    "performances as p": [{ "p.id": "PERF", "p.competency_id": "COM_C01", "p.grade_level": "THIRD",
      "c.area_id": "COM", "a.is_active": true }],
  };
  let queue: Promise<unknown> = Promise.resolve();
  const db: any = {
    tables: () => tables, failInsert: "",
    transaction: () => ({ execute: (callback: (trx: any) => Promise<unknown>) => {
      const task = queue.then(async () => {
        const before = structuredClone(tables);
        try { return await callback(db); } catch (error) { tables = before; throw error; }
      });
      queue = task.catch(() => undefined);
      return task;
    } }),
  };
  function builder(table: string, operation: string) {
    const filters: Array<(row: any) => boolean> = [];
    let values: any;
    const query: any = {};
    for (const method of ["select", "selectAll", "innerJoin", "forUpdate", "forShare", "returningAll"])
      query[method] = () => query;
    query.where = (key: string, operator: string, value: any) => {
      filters.push((row) => operator === "is" ? row[key] == value : row[key] === value); return query;
    };
    query.values = query.set = (value: any) => { values = value; return query; };
    query.execute = async () => {
      if (operation === "insert") {
        if (db.failInsert === table) throw new Error("simulated PostgreSQL failure");
        const row = structuredClone(values);
        for (const key of ["institutional_snapshot", "response"])
          if (typeof row[key] === "string") row[key] = JSON.parse(row[key]);
        tables[table]!.push(row);
        return [row];
      }
      const rows = tables[table]!.filter((row) => filters.every((filter) => filter(row)));
      if (operation === "update") for (const row of rows) {
        Object.assign(row, values);
        if (typeof row.response === "string") row.response = JSON.parse(row.response);
      }
      return rows;
    };
    query.executeTakeFirst = async () => (await query.execute())[0];
    query.executeTakeFirstOrThrow = async () => {
      const row = await query.executeTakeFirst(); if (!row) throw new Error("missing row"); return row;
    };
    return query;
  }
  db.selectFrom = (table: string) => builder(table, "select");
  db.insertInto = (table: string) => builder(table, "insert");
  db.updateTable = (table: string) => builder(table, "update");
  return db;
}
describe("generation orchestration", () => {
  let db: any;
  let preview: any;
  let useCase: GenerateSessionUseCase;
  beforeEach(() => {
    db = memoryDatabase();
    preview = { execute: vi.fn().mockResolvedValue(generationFixture) };
    useCase = new GenerateSessionUseCase(db, preview as PreviewSessionUseCase);
  });
  it("stores content, immutable institutional identity, one debit and a completed idempotency result", async () => {
    const result = await useCase.execute(authFixture, "key", generationInput);
    expect(result.institutionalProfile).toEqual(institutionalFixture);
    expect(db.tables().learning_sessions[0].user_id).toBe(authFixture.sub);
    expect(db.tables().learning_sessions[0].institutional_snapshot).toEqual(institutionalFixture);
    expect(db.tables().credit_wallets[0].balance).toBe(1);
    expect(db.tables().wallet_transactions[0]).toMatchObject({
      amount: -1, balance_before: 2, balance_after: 1, transaction_type: "SESSION_GENERATION_DEBIT",
    });
    expect(await useCase.execute(authFixture, "key", generationInput)).toEqual(result);
    expect(preview.execute).toHaveBeenCalledTimes(1);
    expect(db.tables().wallet_transactions).toHaveLength(1);
  });
  it("rejects reuse with a different payload and accepts a new regeneration key", async () => {
    await useCase.execute(authFixture, "key", generationInput);
    await expect(useCase.execute(authFixture, "key", { ...generationInput, sessionTitle: "Otro título" })).rejects.toMatchObject({ statusCode: 409 });
    await useCase.execute(authFixture, "new-key", generationInput);
    expect(db.tables().learning_sessions).toHaveLength(2);
    expect(db.tables().credit_wallets[0].balance).toBe(0);
  });
  it.each(["gemini", "validation", "postgres"])("does not charge on %s failure and records a failed attempt", async (failure) => {
    if (failure === "gemini") preview.execute.mockRejectedValue(new Error("provider unavailable"));
    if (failure === "validation") preview.execute.mockResolvedValue({ ...generationFixture, moments: [] });
    if (failure === "postgres") db.failInsert = "wallet_transactions";
    await expect(useCase.execute(authFixture, "key", generationInput)).rejects.toThrow();
    expect(db.tables().credit_wallets[0].balance).toBe(2);
    expect(db.tables().learning_sessions).toHaveLength(0);
    expect(db.tables().wallet_transactions).toHaveLength(0);
    expect(db.tables().generation_requests[0].status).toBe("FAILED");
    await expect(useCase.execute(authFixture, "key", generationInput)).rejects.toMatchObject({ statusCode: 409 });
    expect(preview.execute).toHaveBeenCalledTimes(1);
  });
  it.each(["profile", "credits", "expired", "inactive"])("rejects %s before calling Gemini", async (failure) => {
    if (failure === "profile") db.tables().institutional_profiles = [];
    if (failure === "credits") db.tables().credit_wallets[0].balance = 0;
    if (failure === "expired") db.tables().credit_wallets[0].expires_at = new Date(0);
    if (failure === "inactive") db.tables().users[0].is_active = false;
    await expect(useCase.execute(authFixture, "key", generationInput)).rejects.toThrow();
    expect(preview.execute).not.toHaveBeenCalled();
  });
  it("checks account state again after Gemini", async () => {
    preview.execute.mockImplementation(async () => { db.tables().users[0].is_active = false; return generationFixture; });
    await expect(useCase.execute(authFixture, "key", generationInput)).rejects.toMatchObject({ statusCode: 401 });
    expect(db.tables().learning_sessions).toHaveLength(0);
    expect(db.tables().credit_wallets[0].balance).toBe(2);
  });
  it("audits an unlimited generation without a debit, even at zero balance", async () => {
    Object.assign(db.tables().credit_wallets[0], { balance: 0, plan_type: "LIFETIME_FREE", is_unlimited: true, expires_at: null });
    await useCase.execute(authFixture, "key", generationInput);
    expect(db.tables().credit_wallets[0].balance).toBe(0);
    expect(db.tables().wallet_transactions).toHaveLength(0);
    expect(db.tables().generation_requests[0].status).toBe("COMPLETED");
  });
  it("resolves one of two simultaneous requests with the last credit and rolls back the other", async () => {
    db.tables().credit_wallets[0].balance = 1;
    const results = await Promise.allSettled([
      useCase.execute(authFixture, "one", generationInput), useCase.execute(authFixture, "two", generationInput),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(db.tables().credit_wallets[0].balance).toBe(0);
    expect(db.tables().learning_sessions).toHaveLength(1);
  });
  it("rejects frontend identity and ownership fields in generation input", () => {
    expect(generateSessionSchema.safeParse({ ...generationInput, userId: "another", teacherFullName: "Impersonation" }).success).toBe(false);
  });
});
