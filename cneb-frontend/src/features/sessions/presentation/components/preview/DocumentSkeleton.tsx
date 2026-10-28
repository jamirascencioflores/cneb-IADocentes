import { Skeleton } from "@/shared/components/ui/skeleton";
import { Loader2 } from "lucide-react";

export function DocumentSkeleton() {
  return (
    <div className="w-full max-w-[780px] h-auto bg-white p-7 sm:p-9 shadow-lg border border-slate-300 text-slate-900 font-sans text-xs space-y-4 leading-normal rounded-sm">
      {/* Banner de procesamiento activo con IA */}
      <div className="flex items-center justify-center gap-2 rounded bg-emerald-50 border border-emerald-200 py-2 px-3 text-emerald-800">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
        <span className="text-xs font-semibold">
          Gemini LLM está estructurando los momentos pedagógicos y criterios
          observables...
        </span>
      </div>

      {/* Cabecera oficial */}
      <div className="text-center space-y-2 border-b border-slate-300 pb-3 flex flex-col items-center">
        <Skeleton className="h-2.5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>

      {/* Datos Generales */}
      <div className="grid grid-cols-2 gap-2 border border-slate-200 p-2.5 rounded bg-slate-50/50">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/5" />
      </div>

      {/* Título de Sesión */}
      <div className="border-l-4 border-slate-300 bg-slate-50 p-2.5 rounded-r space-y-1">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      {/* Matriz CNEB */}
      <div className="space-y-1">
        <Skeleton className="h-5 w-full bg-slate-700/60" />
        <div className="border border-slate-200 p-2 space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      {/* Secuencia Didáctica */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-full bg-slate-700/60" />
        <div className="space-y-2">
          <div className="border border-slate-200 p-3 rounded space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-6 w-3/4 bg-emerald-100/50" />
          </div>
          <div className="border border-slate-200 p-3 rounded space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-6 w-3/4 bg-emerald-100/50" />
          </div>
          <div className="border border-slate-200 p-3 rounded space-y-2">
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </div>

      {/* Recuadros Finales */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <div className="border border-slate-200 p-2.5 rounded bg-slate-50 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="border border-slate-200 p-2.5 rounded bg-slate-50 space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>

      {/* Firma */}
      <div className="pt-6 flex justify-end">
        <div className="w-52 space-y-1 flex flex-col items-center">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-40" />
        </div>
      </div>
    </div>
  );
}
