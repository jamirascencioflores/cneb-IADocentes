import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { DatabaseSchema, SubscriptionPlanEnum } from "../types.js";
const metadata = vi.hoisted(() => ({ queries: [] as string[] }));
vi.mock("kysely", async (original) => {
  const actual = await original<typeof import("kysely")>();
  return { ...actual, sql: (strings: TemplateStringsArray) => ({
    execute: async () => {
      const query = strings.join("?");
      metadata.queries.push(query);
      return { rows: query.includes("pg_tables") ? [
        "users", "institutional_profiles", "credit_wallets", "wallet_transactions",
        "areas", "competencies", "capacities", "performances", "learning_sessions",
        "session_competencies", "session_moments", "evaluation_instruments", "evaluation_criteria",
      ].map((name) => ({ name })) : [] };
    },
  }) };
});
import { preflight } from "./migrate.js";

const valid = {
  id: "wallet-valid", user_id: "teacher-valid", balance: 0,
  plan_type: "MONTHLY" as SubscriptionPlanEnum, is_unlimited: false, expires_at: new Date(0),
};
describe("read-only wallet preflight (no database connection)", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => { metadata.queries.length = 0; vi.spyOn(console, "log").mockImplementation(() => undefined); });
  it("reports every incompatible wallet and owner before any migration write", async () => {
    const rows = [
      { ...valid, id: "wallet-1", user_id: "teacher-1", is_unlimited: true },
      { ...valid, id: "wallet-2", user_id: "teacher-2", plan_type: "LIFETIME_FREE", expires_at: null },
      { ...valid, id: "wallet-3", user_id: "teacher-3", plan_type: "LIFETIME_FREE", is_unlimited: true },
      { ...valid, id: "wallet-4", user_id: "teacher-4", balance: -1 },
      { ...valid, id: "wallet-5", user_id: "teacher-5", expires_at: new Date(NaN) },
    ];
    const read = { select: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(rows) };
    const db = { selectFrom: vi.fn(() => read), insertInto: vi.fn(), updateTable: vi.fn(),
      deleteFrom: vi.fn(), transaction: vi.fn() };
    const error = await preflight(db as unknown as Kysely<DatabaseSchema>).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(Error);
    for (let index = 1; index <= 5; index++) {
      expect((error as Error).message).toContain("wallet-" + index);
      expect((error as Error).message).toContain("teacher-" + index);
    }
    expect((error as Error).message).toContain("Migraciones detenidas");
    expect(db.insertInto).not.toHaveBeenCalled();
    expect(db.updateTable).not.toHaveBeenCalled();
    expect(db.deleteFrom).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
    expect(metadata.queries.every((query) => query.trim().startsWith("SELECT"))).toBe(true);
  });
  it("accepts expired ordinary plans, zero balance and coherent unlimited plans without modifying them", async () => {
    const rows = [valid, { ...valid, id: "free", plan_type: "LIFETIME_FREE", is_unlimited: true, expires_at: null }];
    const before = structuredClone(rows);
    const db = { selectFrom: vi.fn(() => ({ select: vi.fn().mockReturnThis(), execute: async () => rows })) };
    await expect(preflight(db as unknown as Kysely<DatabaseSchema>)).resolves.toEqual({
      existing: true, hasHistory: false,
    });
    expect(rows).toEqual(before);
  });
});
