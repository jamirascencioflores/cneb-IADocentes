import { httpClient } from "@/shared/lib/http-client";
import type { UserRole } from "@/features/auth/domain/auth.types";
import type {
  InstitutionalProfileEntity,
  UserSessionEntity,
  WalletEntity,
} from "../domain/profile.types";

export interface InstitutionalProfileInput {
  teacher_full_name: string;
  specialty: string;
  school_name: string;
  ugel: string;
  dre: string;
  principal_name?: string | null;
}

export class HttpProfileRepository {
  async getCurrentUser(): Promise<UserSessionEntity> {
    const { data } = await httpClient.get<{
      user: { sub: string; email: string; role: UserRole };
    }>("/auth/me");
    return {
      id: data.user.sub,
      email: data.user.email,
      fullName: data.user.email.split("@")[0],
      role: data.user.role,
    };
  }

  async getInstitutionalProfile(): Promise<InstitutionalProfileEntity | null> {
    try {
      const { data } = await httpClient.get<
        InstitutionalProfileInput & { id: string }
      >("/profile/institutional");
      return {
        schoolId: data.id,
        teacherFullName: data.teacher_full_name,
        principalName: data.principal_name ?? "",
        schoolName: data.school_name,
        ugel: data.ugel,
        drelm: data.dre,
        specialty: data.specialty,
        modularCode: "",
        region: "",
        academicYear: new Date().getFullYear(),
        level: "SECONDARY",
      };
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        error.status === 404
      )
        return null;
      throw error;
    }
  }

  async saveInstitutionalProfile(
    input: InstitutionalProfileInput,
  ): Promise<void> {
    await httpClient.put("/profile/institutional", input);
  }

  async getWallet(): Promise<WalletEntity> {
    const { data } = await httpClient.get<{
      balance: number;
      isUnlimited: boolean;
      planType: string;
    }>("/wallets/me");
    return {
      balance: data.balance,
      isUnlimited: data.isUnlimited,
      planName: data.planType,
      currency: "",
    };
  }
}
export const profileRepository = new HttpProfileRepository();
