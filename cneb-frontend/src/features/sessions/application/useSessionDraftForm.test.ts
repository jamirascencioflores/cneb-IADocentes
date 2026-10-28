import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useSessionDraftForm } from "./useSessionDraftForm";

describe("useSessionDraftForm", () => {
  it("debe inicializarse con los valores predeterminados válidos de la sesión", async () => {
    const { result } = renderHook(() => useSessionDraftForm());

    expect(result.current.getValues("areaId")).toBe("COM");
    expect(result.current.getValues("gradeLevel")).toBe("THIRD");
    expect(result.current.getValues("pedagogicalDuration")).toBe("MINUTES_90");

    let isValid = false;
    await act(async () => {
      isValid = await result.current.trigger();
    });

    expect(isValid).toBe(true);
    expect(result.current.formState.errors).toEqual({});
  });

  it("debe fallar la validación si el título de la unidad es demasiado corto", async () => {
    const { result } = renderHook(() => {
      const hook = useSessionDraftForm();
      // Suscribe el proxy de formState leyendo errors
      void hook.formState.errors.unitTitle;
      return hook;
    });

    await act(async () => {
      result.current.setValue("unitTitle", "ab", {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
      await result.current.trigger("unitTitle");
    });

    expect(result.current.formState.errors.unitTitle?.message).toBe(
      "La unidad didáctica debe tener al menos 3 caracteres",
    );
  });

  it("debe invalidar el formulario si se dejan las secciones vacías", async () => {
    const { result } = renderHook(() => {
      const hook = useSessionDraftForm();
      // Suscribe el proxy de formState leyendo errors
      void hook.formState.errors.sections;
      return hook;
    });

    await act(async () => {
      result.current.setValue("sections", [], {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
      await result.current.trigger("sections");
    });

    expect(result.current.formState.errors.sections?.message).toBe(
      "Seleccione al menos una sección",
    );
  });
});
