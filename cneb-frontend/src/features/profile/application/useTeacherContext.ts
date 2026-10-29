import { useQuery } from "@tanstack/react-query";
import { profileRepository } from "../infrastructure/http-profile.repository";
import { authRepository } from "@/features/auth/infrastructure/http-auth.repository";
import type {
  InstitutionalProfileEntity,
  UserSessionEntity,
  WalletEntity,
} from "../domain/profile.types";

const emptyUser: UserSessionEntity = {
  id: "",
  email: "",
  fullName: "",
  role: "TEACHER",
};
const emptyInstitution: InstitutionalProfileEntity = {
  schoolId: "",
  schoolName: "Perfil institucional pendiente",
  modularCode: "",
  ugel: "",
  drelm: "",
  region: "",
  academicYear: new Date().getFullYear(),
  level: "SECONDARY",
};
const emptyWallet: WalletEntity = {
  balance: 0,
  isUnlimited: false,
  currency: "",
  planName: "",
};

export function useTeacherContext() {
  const enabled = authRepository.isAuthenticated();
  const userQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => profileRepository.getCurrentUser(),
    enabled,
    retry: false,
  });
  const institutionQuery = useQuery({
    queryKey: ["profile", "institutional"],
    queryFn: () => profileRepository.getInstitutionalProfile(),
    enabled,
    retry: false,
  });
  const walletQuery = useQuery({
    queryKey: ["wallets", "me"],
    queryFn: () => profileRepository.getWallet(),
    enabled,
    retry: false,
  });
  const profileMissing =
    institutionQuery.isSuccess && institutionQuery.data === null;
  return {
    user: userQuery.data ?? emptyUser,
    institution: institutionQuery.data ?? emptyInstitution,
    wallet: walletQuery.data ?? emptyWallet,
    walletAvailable: walletQuery.isSuccess,
    profileMissing,
    profileMessage: profileMissing
      ? "Tu cuenta debe ser configurada por el administrador. Contacta al administrador para registrar tus datos institucionales."
      : null,
    isLoading:
      userQuery.isPending ||
      institutionQuery.isPending ||
      walletQuery.isPending,
    error: userQuery.error ?? institutionQuery.error ?? walletQuery.error,
  };
}
