import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Formato de correo inválido"),
  password: z.string().min(8, "La contraseña debe tener mínimo 8 caracteres"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
