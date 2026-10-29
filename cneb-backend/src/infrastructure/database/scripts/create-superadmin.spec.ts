import { describe, expect, it } from "vitest";
import { superadminOptions } from "./create-superadmin.js";

describe("SUPERADMIN CLI credential boundary (script main is never executed)", () => {
  it("accepts only email and the explicit execution flag", () => {
    expect(superadminOptions(["--email", "admin@example.com", "--apply"])).toMatchObject({
      email: "admin@example.com", apply: true,
    });
  });
  it.each([
    ["--password", "SecretThatMustNeverBeEchoed!"],
    ["--password=SecretThatMustNeverBeEchoed!"],
    ["SecretThatMustNeverBeEchoed!"],
  ])("rejects command-line passwords without including their value in errors", (...args) => {
    let message = "";
    try { superadminOptions(args); } catch (error) { message = (error as Error).message; }
    expect(message).toContain("SUPERADMIN_PASSWORD");
    expect(message).not.toContain("SecretThatMustNeverBeEchoed!");
  });
});
