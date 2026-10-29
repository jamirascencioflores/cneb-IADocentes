import { UserRole } from "@/features/auth/domain/auth.types";

export interface UserSessionEntity {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface InstitutionalProfileEntity {
  schoolId: string;
  teacherFullName?: string;
  principalName?: string;
  schoolName: string;
  modularCode: string;
  ugel: string;
  drelm: string;
  region: string;
  academicYear: number;
  level: "SECONDARY";
  specialty?: string;
}

export interface WalletEntity {
  balance: number;
  isUnlimited: boolean;
  currency: string;
  planName: string;
}
