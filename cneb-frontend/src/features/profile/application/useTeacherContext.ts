import { useQuery } from "@tanstack/react-query";
import { profileRepository } from "../infrastructure/http-profile.repository";
import { authRepository } from "@/features/auth/infrastructure/http-auth.repository";
import {
  InstitutionalProfileEntity,
  UserSessionEntity,
  WalletEntity,
} from "../domain/profile.types";

const fallbackUser: UserSessionEntity = {
  id: "teacher-default",
  email: "docente.demo@cneb.pe",
  fullName: "Jamir Jafet Ascencio Flores",
  role: "TEACHER",
};

const fallbackInstitution: InstitutionalProfileEntity = {
  schoolId: "sch-6066",
  schoolName: 'I.E. N.° 6066 "VILLA EL SALVADOR"',
  modularCode: "0345678",
  ugel: "UGEL 01 SAN JUAN DE MIRAFLORES / VILLA EL SALVADOR",
  drelm: "DRELM",
  region: "LIMA METROPOLITANA",
  academicYear: 2026,
  level: "SECONDARY",
  specialty: "Comunicación",
};

const fallbackWallet: WalletEntity = {
  balance: 24,
  isUnlimited: false,
  currency: "PEN",
  planName: "Plan Docente Pro",
};

export function useTeacherContext() {
  const hasToken = authRepository.isAuthenticated();

  const userQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => profileRepository.getCurrentUser(),
    placeholderData: fallbackUser,
    enabled: hasToken,
    retry: false,
    staleTime: 1000 * 60 * 10,
  });

  const institutionQuery = useQuery({
    queryKey: ["profile", "institutional"],
    queryFn: () => profileRepository.getInstitutionalProfile(),
    placeholderData: fallbackInstitution,
    enabled: false, // Desactivado hasta que el endpoint esté creado en el backend
    retry: false,
  });

  const walletQuery = useQuery({
    queryKey: ["wallets", "me"],
    queryFn: () => profileRepository.getWallet(),
    placeholderData: fallbackWallet,
    enabled: hasToken,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  return {
    user: userQuery.data ?? fallbackUser,
    institution: institutionQuery.data ?? fallbackInstitution,
    wallet: walletQuery.data ?? fallbackWallet,
    isLoading:
      userQuery.isLoading ||
      institutionQuery.isLoading ||
      walletQuery.isLoading,
  };
}
