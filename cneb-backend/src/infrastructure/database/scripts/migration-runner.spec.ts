import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { DatabaseSchema } from "../types.js";

interface State { history: Map<string, string>; sources: string[]; }
interface Executor {
  statement(query: string, values: unknown[]): Promise<{ rows: { checksum: string }[] }>;
  source(value: string): Promise<void>;
}
vi.mock("kysely", async (original) => {
  const actual = await original<typeof import("kysely")>();
  const tag = Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => ({
    execute: (executor: Executor) => executor.statement(strings.join("?"), values),
  }), { raw: (value: string) => ({ execute: (executor: Executor) => executor.source(value) }) });
  return { ...actual, sql: tag };
});
import { applyMigrations } from "./migration-runner.js";

function fixture() {
  const counters = { commits: 0, rollbacks: 0, locks: 0, unlocks: 0 };
  function connection(state: State) {
    return {
      state,
      async statement(query: string, values: unknown[]) {
        if (query.includes("pg_advisory_lock")) counters.locks++;
        if (query.includes("pg_advisory_unlock")) counters.unlocks++;
        if (query.startsWith("SELECT checksum")) {
          const checksum = state.history.get(String(values[0]));
          return { rows: checksum ? [{ checksum }] : [] };
        }
        if (query.startsWith("INSERT INTO schema_migrations")) state.history.set(String(values[0]), String(values[1]));
        return { rows: [] };
      },
      async source(value: string) {
        if (value === "INJECTED_FAILURE") throw new Error("Injected migration failure");
        state.sources.push(value);
      },
      transaction: () => ({ execute: async (operation: (tx: Kysely<DatabaseSchema>) => Promise<unknown>) => {
        const staged = structuredClone(state);
        try {
          await operation(connection(staged) as unknown as Kysely<DatabaseSchema>);
          state.history = staged.history; state.sources = staged.sources; counters.commits++;
        } catch (error) { counters.rollbacks++; throw error; }
      } }),
    };
  }
  const conn = connection({ history: new Map(), sources: [] });
  return { conn, db: conn as unknown as Kysely<DatabaseSchema>, counters };
}
describe("migration execution core (transaction doubles, no PostgreSQL)", () => {
  it("records raw-source SHA-256 per committed migration and skips an identical second execution", async () => {
    const { conn, db, counters } = fixture();
    const files = [{ name: "001_initial_schema.sql", source: "FIRST" }, { name: "008_admin_audit.sql", source: "SECOND" }];
    expect(await applyMigrations(db, files)).toEqual(files.map((file) => file.name));
    expect([...conn.state.history]).toEqual(files.map((file) => [file.name, createHash("sha256").update(file.source).digest("hex")]));
    expect(await applyMigrations(db, files)).toEqual([]);
    expect(conn.state.sources).toEqual(["FIRST", "SECOND"]);
    expect(counters).toEqual({ commits: 2, rollbacks: 0, locks: 2, unlocks: 2 });
  });
  it("rejects a changed applied migration without replacing history and releases the lock", async () => {
    const { conn, db, counters } = fixture();
    await applyMigrations(db, [{ name: "008_admin_audit.sql", source: "APPROVED" }]);
    const before = structuredClone(conn.state);
    await expect(applyMigrations(db, [{ name: "008_admin_audit.sql", source: "CHANGED" }])).rejects.toThrow(/modificada/);
    expect(conn.state).toEqual(before); expect(counters.unlocks).toBe(2);
  });
  it("does not record a failing migration and preserves prior independently committed migrations", async () => {
    const { conn, db, counters } = fixture();
    await expect(applyMigrations(db, [{ name: "008_admin_audit.sql", source: "SUCCESS" },
      { name: "009_normalized_email.sql", source: "INJECTED_FAILURE" }])).rejects.toThrow(/Injected/);
    expect([...conn.state.history.keys()]).toEqual(["008_admin_audit.sql"]);
    expect(conn.state.sources).toEqual(["SUCCESS"]);
    expect(counters).toEqual({ commits: 1, rollbacks: 1, locks: 1, unlocks: 1 });
  });
  it("retains explicit existing-schema baseline semantics without rerunning 001", async () => {
    const { conn, db } = fixture();
    expect(await applyMigrations(db, [{ name: "001_initial_schema.sql", source: "BASELINE" }], true)).toEqual(["001_initial_schema.sql"]);
    expect(conn.state.history.size).toBe(1); expect(conn.state.sources).toHaveLength(0);
  });
});
