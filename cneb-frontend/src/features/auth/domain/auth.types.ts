import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Ingrese un correo electrónico válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export type LoginCredentials = z.infer<typeof loginSchema>;

export type UserRole = "SUPERADMIN" | "TEACHER";

export interface LoginResponseDto {
  accessToken?: string;
  access_token?: string;
  token?: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}
