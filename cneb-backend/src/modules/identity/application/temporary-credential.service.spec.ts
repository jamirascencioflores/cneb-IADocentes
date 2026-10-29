import { expect, it, vi } from "vitest";
import { TemporaryCredentialService } from "./temporary-credential.service.js";
it("creates independent secure temporary credentials and hashes exactly the returned secret", async () => {
  const hash = { hash: vi.fn(async () => "argon2-test-hash"), compare: vi.fn() };
  const service = new TemporaryCredentialService(hash);
  const first = await service.create(), second = await service.create();
  expect(first.temporaryPassword).toMatch(/^[A-Za-z0-9_-]{32}$/);
  expect(first.temporaryPassword).not.toBe(second.temporaryPassword);
  expect(first.passwordHash).toBe("argon2-test-hash");
  expect(hash.hash).toHaveBeenCalledWith(first.temporaryPassword);
});
