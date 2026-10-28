import { ProblemDetails } from "@/shared/types/problem-details.types";
import { AlertCircle, CreditCard, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

interface ProblemDetailsDialogProps {
  problem: ProblemDetails | null;
  onClose: () => void;
}

export function ProblemDetailsDialog({
  problem,
  onClose,
}: ProblemDetailsDialogProps) {
  if (!problem) return null;

  const isPaymentError = problem.status === 402;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-lg border bg-white p-5 shadow-xl space-y-4">
        {/* Cabecera del diálogo */}
        <div className="flex items-start justify-between border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`rounded-full p-2 ${
                isPaymentError
                  ? "bg-amber-100 text-amber-700"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              {isPaymentError ? (
                <CreditCard className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {problem.title || "Notificación del Servidor"}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Código de estado: {problem.status}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Detalle del error RFC 7807 */}
        <div className="space-y-2 text-xs text-slate-700">
          <p className="leading-relaxed bg-slate-50 p-3 rounded border border-slate-200">
            {problem.detail ||
              "Ha ocurrido un problema al procesar la solicitud con el servidor."}
          </p>

          {/* Errores de validación específicos (422) */}
          {problem.invalidParams && problem.invalidParams.length > 0 && (
            <div className="space-y-1 pt-1">
              <span className="font-semibold text-slate-800">
                Campos a corregir:
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-rose-600 font-medium">
                {problem.invalidParams.map((param, index) => (
                  <li key={index}>
                    <span className="font-semibold">{param.field}:</span>{" "}
                    {param.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex justify-end pt-2 border-t">
          <Button
            type="button"
            size="sm"
            onClick={onClose}
            className={
              isPaymentError
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-slate-900 hover:bg-slate-800 text-white"
            }
          >
            {isPaymentError ? "Entendido / Revisar Créditos" : "Cerrar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
