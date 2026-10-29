import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTeacherContext } from "../../application/useTeacherContext";
import {
  profileRepository,
  type InstitutionalProfileInput,
} from "../../infrastructure/http-profile.repository";

export function InstitutionalProfileForm() {
  const { institution, profileMissing, isLoading } = useTeacherContext();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const mutation = useMutation({
    mutationFn: (data: InstitutionalProfileInput) =>
      profileRepository.saveInstitutionalProfile(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["profile", "institutional"],
      });
      setEditing(false);
    },
  });
  if (isLoading) return <p role="status">Cargando tu cuenta…</p>;
  if (!editing && !profileMissing)
    return (
      <button
        type="button"
        className="text-sm underline"
        onClick={() => setEditing(true)}
      >
        Editar perfil institucional
      </button>
    );
  const fields = [
    [
      "teacher_full_name",
      "Nombre del docente",
      institution.teacherFullName ?? "",
      150,
    ],
    ["specialty", "Especialidad", institution.specialty ?? "", 100],
    [
      "school_name",
      "Institución educativa",
      institution.schoolId ? institution.schoolName : "",
      200,
    ],
    ["ugel", "UGEL", institution.ugel, 50],
    ["dre", "DRE", institution.drelm, 100],
  ] as const;
  return (
    <form
      key={institution.schoolId}
      className="rounded border bg-white p-4 mb-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        mutation.mutate({
          teacher_full_name: String(data.get("teacher_full_name")),
          specialty: String(data.get("specialty")),
          school_name: String(data.get("school_name")),
          ugel: String(data.get("ugel")),
          dre: String(data.get("dre")),
          principal_name: String(data.get("principal_name") ?? "") || null,
        });
      }}
    >
      <p className="font-semibold mb-2">
        Datos institucionales para tus documentos
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([name, label, value, max]) => (
          <label key={name} className="text-sm">
            {label}
            <input
              className="block border rounded p-2 w-full"
              name={name}
              defaultValue={value}
              required
              minLength={name === "dre" ? 1 : 3}
              maxLength={max}
            />
          </label>
        ))}
        <label className="text-sm">
          Director/a (opcional)
          <input
            className="block border rounded p-2 w-full"
            name="principal_name"
            defaultValue={institution.principalName ?? ""}
            maxLength={150}
          />
        </label>
      </div>
      {mutation.isError && (
        <p role="alert" className="text-red-700">
          No se pudo guardar el perfil. Revisa los datos e intenta nuevamente.
        </p>
      )}
      <button
        className="rounded bg-emerald-700 text-white p-2 mt-3"
        disabled={mutation.isPending}
        type="submit"
      >
        {mutation.isPending ? "Guardando…" : "Guardar perfil"}
      </button>
      {!profileMissing && (
        <button
          type="button"
          className="ml-3"
          onClick={() => setEditing(false)}
        >
          Cancelar
        </button>
      )}
    </form>
  );
}
