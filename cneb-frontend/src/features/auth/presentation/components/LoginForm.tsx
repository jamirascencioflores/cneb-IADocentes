import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginCredentials } from "../../domain/auth.types";
import { authRepository } from "../../infrastructure/http-auth.repository";
import { httpClient } from "@/shared/lib/http-client";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Lock, Mail, Loader2, Sparkles, UserPlus } from "lucide-react";

interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "docente.demo@cneb.pe",
      password: "Docente2026!",
    },
  });

  const onSubmit = async (data: LoginCredentials) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await authRepository.login(data);
      onSuccess();
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        "Credenciales no válidas. Si es tu primera vez, dale clic a 'Registrar usuario demo'.";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSeed = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const email = getValues("email");
    const password = getValues("password");

    try {
      // 1. Registrar usuario
      const regRes = await httpClient.post<{ access_token?: string }>(
        "/auth/register",
        { email, password },
      );

      // Si el register ya devuelve el token, guardarlo
      if (regRes.data?.access_token) {
        localStorage.setItem("cneb_access_token", regRes.data.access_token);
        onSuccess();
        return;
      }

      // 2. Si no lo devuelve, hacer login explícito
      const loginRes = await authRepository.login({ email, password });
      if (loginRes.access_token) {
        onSuccess();
      }
    } catch {
      try {
        await authRepository.login({ email, password });
        onSuccess();
      } catch (loginErr: unknown) {
        const msg =
          (loginErr as { message?: string })?.message ||
          "Error al autenticar con el usuario demo.";
        setErrorMsg(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 min-h-screen p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-8 shadow-2xl space-y-6 text-white">
        {/* Cabecera Institucional */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white font-extrabold text-base shadow-lg shadow-emerald-900/50">
            CNEB
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">
            Planificador Curricular CNEB
          </h1>
          <p className="text-xs text-slate-400">
            I.E. N.° 6066 Villa El Salvador • UGEL 01 SJM
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-rose-950/50 border border-rose-800 p-3 text-xs text-rose-300 font-medium">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="rounded-lg bg-emerald-950/50 border border-emerald-800 p-3 text-xs text-emerald-300 font-medium">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              Correo Electrónico Oficial:
            </label>
            <Input
              type="email"
              {...register("email")}
              className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-500"
              placeholder="docente.demo@cneb.pe"
            />
            {errors.email && (
              <p className="text-[11px] text-rose-400">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              Contraseña:
            </label>
            <Input
              type="password"
              {...register("password")}
              className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-500"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-[11px] text-rose-400">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2 pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 shadow-md shadow-emerald-950 text-xs"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Conectando...
                </>
              ) : (
                "Ingresar al Sistema"
              )}
            </Button>

            {/* Opción de Registrar si no existe en la DB local */}
            <Button
              type="button"
              variant="outline"
              onClick={handleRegisterSeed}
              disabled={isLoading}
              className="w-full border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-300 hover:text-white text-xs gap-2"
            >
              <UserPlus className="h-3.5 w-3.5 text-emerald-400" />
              Registrar usuario demo (si es 1.ª vez)
            </Button>
          </div>
        </form>

        <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-[11px] text-slate-400">
          <span>Credenciales CNEB 2026</span>
          <button
            type="button"
            onClick={() => {
              setValue("email", "docente.demo@cneb.pe");
              setValue("password", "Docente2026!");
            }}
            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold"
          >
            <Sparkles className="h-3 w-3" />
            Restablecer demo
          </button>
        </div>
      </div>
    </div>
  );
}
