import { describe, expect, it } from "vitest";
import { approvedStage2Target, loadStage2Migrations, requireStage2TestTarget, verifyStage1Migrations } from "./admin-postgres-test-support.js";

const valid = { url: "postgresql://test-user:test-password@127.0.0.1:5432/cneb_stage1_test_20261029",
  confirmed: approvedStage2Target, apply: "YES" };
describe("PostgreSQL opt-in safeguards (no pools, environment files or database)", () => {
  it("accepts only explicit approval and the local dedicated database", () => {
    expect(requireStage2TestTarget(valid)).toBe(valid.url);
  });
  it.each([
    { apply: undefined }, { apply: "NO" }, { url: undefined }, { confirmed: undefined },
    { confirmed: "postgresql://localhost:5432/cneb_stage1_test_20261029" },
    { url: valid.url.replace("127.0.0.1", "remote.invalid") },
    { url: valid.url.replace(":5432", ":5433") }, { url: valid.url.replace("cneb_stage1_test_20261029", "development") },
    { url: valid.url.replace(":5432", "") },
    { url: valid.url + "?host=remote.invalid" }, { url: valid.url + "#untrusted" },
    { url: "INVALID_SECRET_URL" },
  ])("rejects missing opt-in or an unsafe target before any connection %j", (override) => {
    expect(() => requireStage2TestTarget({ ...valid, ...override })).toThrow();
    try { requireStage2TestTarget({ ...valid, ...override }); } catch (error) {
      expect(String(error)).not.toMatch(/test-password|INVALID_SECRET_URL/);
    }
  });
  it("loads exactly 001–012 and verifies the seven approved Stage 1 checksums", async () => {
    const migrations = await loadStage2Migrations();
    expect(migrations).toHaveLength(12);
    expect(() => verifyStage1Migrations(migrations)).not.toThrow();
    expect(() => verifyStage1Migrations(migrations.slice(1))).toThrow(/ausente/);
    expect(() => verifyStage1Migrations(migrations.map((file, index) => index === 0
      ? { ...file, source: file.source + "-- tampered" } : file))).toThrow(/modificada/);
  });
});
