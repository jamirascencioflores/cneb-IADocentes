import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./input";

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ className = "", ...props }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative min-w-0">
        <Input {...props} ref={ref} type={visible ? "text" : "password"}
          className={`min-h-11 w-full pr-12 ${className}`} />
        <button type="button" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible} onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-emerald-500">
          {visible ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
        </button>
      </div>
    );
  },
);
