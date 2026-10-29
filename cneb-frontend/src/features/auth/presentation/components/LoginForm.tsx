import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginCredentials } from "../../domain/auth.types";
import { authRepository } from "../../infrastructure/http-auth.repository";
import { Input } from "@/shared/components/ui/input";
import { PasswordInput } from "@/shared/components/ui/password-input";
import { Button } from "@/shared/components/ui/button";
import { Loader2 } from "lucide-react";

interface LoginFormProps { onSuccess: () => void; }

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" },
  });
  const submit = async (credentials: LoginCredentials) => {
    setError(null);
    try { await authRepository.login(credentials); onSuccess(); }
    catch (reason) {
      setError(reason && typeof reason === "object" && "message" in reason
        ? String(reason.message) : "No se pudo iniciar sesión.");
    }
  };
  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-8 text-white flex items-center justify-center">
      <section className="w-full min-w-0 max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-8">
        <h1 className="text-xl font-bold">CNEB Docentes</h1>
        <p className="mt-2 text-sm text-slate-300">Ingresa con la cuenta proporcionada por el administrador.</p>
        <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-5">
          <div>
            <label htmlFor="login-email" className="mb-2 block text-sm">Correo electrónico</label>
            <Input id="login-email" type="email" autoComplete="username" {...register("email")}
              aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined}
              className="min-h-11 bg-slate-950 border-slate-700 text-white" />
            {errors.email && <p id="email-error" className="mt-1 text-sm text-rose-300">{errors.email.message}</p>}
          </div>
          <div>
            <label htmlFor="login-password" className="mb-2 block text-sm">Contraseña</label>
            <PasswordInput id="login-password" autoComplete="current-password" {...register("password")}
              aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined}
              className="bg-slate-950 border-slate-700 text-white" />
            {errors.password && <p id="password-error" className="mt-1 text-sm text-rose-300">{errors.password.message}</p>}
          </div>
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          <Button type="submit" disabled={isSubmitting} className="min-h-11 w-full bg-emerald-700 text-white">
            {isSubmitting && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Ingresando…" : "Ingresar al sistema"}
          </Button>
        </form>
      </section>
    </main>
  );
}
