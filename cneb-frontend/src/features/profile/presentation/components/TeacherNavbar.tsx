import { useTeacherContext } from "../../application/useTeacherContext";
import { authRepository } from "@/features/auth/infrastructure/http-auth.repository";
import { Badge } from "@/shared/components/ui/badge";
import { Coins, Sparkles, LogOut } from "lucide-react";

export function TeacherNavbar() {
  const { user, institution, wallet } = useTeacherContext();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  };

  const handleLogout = () => {
    authRepository.logout();
    window.location.reload();
  };

  return (
    <header className="border-b bg-white px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-sm sticky top-0 z-10">
      {/* Información Institucional */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-emerald-600 flex items-center justify-center text-white font-extrabold text-xs shadow-sm">
          CNEB
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-900 tracking-tight">
              Docente CNEB
            </span>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              Año Lectivo {institution.academicYear}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium">
            {institution.schoolName} • {institution.ugel}
          </p>
        </div>
      </div>

      {/* Saldo de Billetera y Perfil del Docente */}
      <div className="flex items-center gap-4">
        {/* Chip de Créditos / Plan */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 shadow-xs">
          {wallet.isUnlimited ? (
            <Badge variant="success" className="gap-1 text-[11px] font-bold">
              <Sparkles className="h-3 w-3 text-emerald-600" />
              Ilimitado
            </Badge>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-700">
              <Coins className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-bold text-slate-900">{wallet.balance}</span>
              <span className="text-[11px] text-slate-500">créditos</span>
            </div>
          )}
        </div>

        {/* Identidad del Docente */}
        <div className="flex items-center gap-2.5 border-r pr-3">
          <div className="text-right">
            <p className="text-xs font-bold text-slate-900 leading-tight">
              {user.fullName}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">
              {user.role === "SUPERADMIN"
                ? "Administrador del Sistema"
                : `Secundaria • ${institution.specialty || "General"}`}
            </p>
          </div>
          <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center font-bold text-xs text-slate-700 shadow-xs">
            {getInitials(user.fullName)}
          </div>
        </div>

        {/* Botón Cerrar Sesión */}
        <button
          type="button"
          onClick={handleLogout}
          title="Cerrar Sesión"
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden md:inline">Salir</span>
        </button>
      </div>
    </header>
  );
}
