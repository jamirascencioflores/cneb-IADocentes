import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpProfileRepository } from "./http-profile.repository";
import { httpClient } from "@/shared/lib/http-client";
vi.mock("@/shared/lib/http-client", () => ({ httpClient: { get: vi.fn() } }));
const repository = new HttpProfileRepository();
beforeEach(() => vi.clearAllMocks());
describe("profile API contracts", () => {
  it("reads the JWT user envelope from /auth/me", async () => {
    vi.mocked(httpClient.get).mockResolvedValue({
      data: { user: { sub: "u1", email: "ana@example.com", role: "TEACHER" } },
    });
    expect(await repository.getCurrentUser()).toEqual({
      id: "u1",
      email: "ana@example.com",
      fullName: "ana",
      role: "TEACHER",
    });
  });
  it("reads unlimited balance and plan in camelCase", async () => {
    vi.mocked(httpClient.get).mockResolvedValue({
      data: { balance: 0, isUnlimited: true, planType: "LIFETIME_FREE" },
    });
    expect(await repository.getWallet()).toMatchObject({
      isUnlimited: true,
      planName: "LIFETIME_FREE",
    });
  });
  it("only treats 404 as a missing profile", async () => {
    vi.mocked(httpClient.get)
      .mockRejectedValueOnce({ status: 404 })
      .mockRejectedValueOnce({ status: 500 });
    expect(await repository.getInstitutionalProfile()).toBeNull();
    await expect(repository.getInstitutionalProfile()).rejects.toEqual({
      status: 500,
    });
  });
});
