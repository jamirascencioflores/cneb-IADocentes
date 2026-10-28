import { httpClient } from "@/shared/lib/http-client";
import { UserRole } from "@/features/auth/domain/auth.types";
import {
  InstitutionalProfileEntity,
  UserSessionEntity,
  WalletEntity,
} from "../domain/profile.types";

export interface IProfileRepository {
  getCurrentUser(): Promise<UserSessionEntity>;
  getInstitutionalProfile(): Promise<InstitutionalProfileEntity>;
  getWallet(): Promise<WalletEntity>;
}

export const DEFAULT_INSTITUTIONAL_PAYLOAD = {
  teacher_full_name: "Miriam Flores Cruz",
  specialty: "Comunicación",
  school_name: 'I.E. N.° 6066 "Villa El Salvador"',
  ugel: "UGEL 01 San Juan de Miraflores / Villa El Salvador",
  dre: "DRELM",
  principal_name: "Mg. Elena Salazar V.",
  badge_url: null,
  signature_url: null,
};

export class HttpProfileRepository implements IProfileRepository {
  async getCurrentUser(): Promise<UserSessionEntity> {
    const response = await httpClient.get<{
      id: string;
      email: string;
      full_name?: string;
      role: UserRole;
      avatar_url?: string;
    }>("/auth/me");

    return {
      id: response.data.id,
      email: response.data.email,
      fullName: response.data.full_name || response.data.email.split("@")[0],
      role: response.data.role,
      avatarUrl: response.data.avatar_url,
    };
  }

  async getInstitutionalProfile(): Promise<InstitutionalProfileEntity> {
    try {
      const response = await httpClient.get<{
        teacher_full_name: string;
        specialty: string;
        school_name: string;
        ugel: string;
        dre: string;
        principal_name: string;
        badge_url?: string | null;
        signature_url?: string | null;
      }>("/profile/institutional");

      return {
        schoolId: "sch-profile",
        schoolName: response.data.school_name,
        modularCode: "0345678",
        ugel: response.data.ugel,
        drelm: response.data.dre,
        region: "LIMA METROPOLITANA",
        academicYear: 2026,
        level: "SECONDARY",
        specialty: response.data.specialty,
      };
    } catch {
      // Si aún no está creado en la DB o no existe la ruta PUT, usamos el perfil oficial local
      return {
        schoolId: "sch-profile",
        schoolName: DEFAULT_INSTITUTIONAL_PAYLOAD.school_name,
        modularCode: "0345678",
        ugel: DEFAULT_INSTITUTIONAL_PAYLOAD.ugel,
        drelm: DEFAULT_INSTITUTIONAL_PAYLOAD.dre,
        region: "LIMA METROPOLITANA",
        academicYear: 2026,
        level: "SECONDARY",
        specialty: DEFAULT_INSTITUTIONAL_PAYLOAD.specialty,
      };
    }
  }

  async getWallet(): Promise<WalletEntity> {
    const response = await httpClient.get<{
      balance: number;
      is_unlimited: boolean;
      currency: string;
      plan_name: string;
    }>("/wallets/me");

    return {
      balance: response.data.balance,
      isUnlimited: response.data.is_unlimited,
      currency: response.data.currency,
      planName: response.data.plan_name,
    };
  }
}

export const profileRepository = new HttpProfileRepository();
