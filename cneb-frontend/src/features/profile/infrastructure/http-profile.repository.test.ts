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
  it("reads institutional data registered by the administrator", async () => {
    vi.mocked(httpClient.get).mockResolvedValue({
      data: {
        id: "profile-1",
        teacher_full_name: "Ana Docente",
        specialty: "Comunicación",
        school_name: "Escuela de prueba",
        ugel: "UGEL 01",
        dre: "DRE de prueba",
        principal_name: "Rosa Directora",
      },
    });

    expect(await repository.getInstitutionalProfile()).toMatchObject({
      schoolId: "profile-1",
      teacherFullName: "Ana Docente",
      specialty: "Comunicación",
      schoolName: "Escuela de prueba",
      ugel: "UGEL 01",
      drelm: "DRE de prueba",
      principalName: "Rosa Directora",
    });
    expect(httpClient.get).toHaveBeenCalledWith("/profile/institutional");
  });
});
