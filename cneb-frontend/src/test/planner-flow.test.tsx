import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { httpClient } from "@/shared/lib/http-client";
import { generatedSession } from "./session-preview.fixture";
import { webcrypto } from "node:crypto";

vi.mock("@/shared/lib/http-client", () => ({
  httpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it.each([false, true])("loads account data and enforces institutional access (profile missing: %s)", async (profileMissing) => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  localStorage.setItem("cneb_access_token", "test-token");
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL() {
        return "blob:test";
      }
      static revokeObjectURL() {}
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.mocked(httpClient.get).mockImplementation(async (url, config) => {
    if (url === "/auth/me")
      return {
        data: {
          user: { sub: "teacher", email: "ana@example.com", role: "TEACHER" },
        },
      };
    if (url === "/wallets/me")
      return { data: { balance: 5, isUnlimited: false, planType: "TRIAL" } };
    if (url === "/profile/institutional") {
      if (profileMissing) throw { status: 404 };
      return {
        data: {
          id: "profile",
          teacher_full_name: "Ana Docente",
          school_name: "Escuela de prueba",
          specialty: "Comunicación",
          ugel: "UGEL 01",
          dre: "DRE de prueba",
        },
      };
    }
    if (url === "/curriculum/areas")
      return { data: [{ id: "COM", name: "Comunicación", cycle: "VI-VII" }] };
    if (url?.includes("/curriculum/"))
      return {
        data: {
          areaId: "COM",
          areaName: "Comunicación",
          gradeLevel: (config?.params as { grade_level?: string } | undefined)
            ?.grade_level,
          competencies: [
            {
              id: "COM_C01",
              title: "Se comunica oralmente",
              description: "Comunicación oral",
              capacities: [],
              performances: [
                {
                  id:
                    (config?.params as { grade_level?: string } | undefined)
                      ?.grade_level === "FIRST"
                      ? "PERF_COM_01_1G"
                      : "PERF_COM_01_3G",
                  standardDescription: "Desempeño del grado seleccionado",
                },
              ],
            },
          ],
        },
      };
    if (url?.endsWith("/export-docx")) return { data: new Blob(["docx"]) };
    throw new Error(`Unexpected GET ${url}`);
  });
  let saves = 0;
  vi.mocked(httpClient.post).mockImplementation(async (url) => {
    if (url === "/sessions/generate")
      return { data: { ...generatedSession,
        id: `00000000-0000-4000-8000-00000000000${++saves}`,
        institutionalProfile: { teacherFullName: "Ana Docente", schoolName: "Escuela de prueba",
          specialty: "Comunicación", ugel: "UGEL 01", dre: "DRE de prueba",
          principalName: null, badgeUrl: null, signatureUrl: null },
      } };
    throw new Error(`Unexpected POST ${url}`);
  });
  const user = userEvent.setup();
  const { container } = render(<App />);
  if (profileMissing) {
    await screen.findByText(/Tu cuenta debe ser configurada por el administrador/);
  } else {
    await screen.findAllByText("Ana Docente");
    expect(screen.getAllByText(/Escuela de prueba/).length).toBeGreaterThan(1);
    expect(screen.getByText("DRE de prueba • UGEL 01")).toBeInTheDocument();
  }
  expect(screen.queryByRole("button", { name: /Editar perfil institucional|Guardar perfil/ })).not.toBeInTheDocument();
  expect(container.querySelector('[name="teacher_full_name"], [name="specialty"], [name="school_name"], [name="ugel"], [name="dre"], [name="principal_name"]')).toBeNull();
  const download = screen.getByRole("button", {
    name: "Descargar Word (.docx)",
  });
  expect(download).toBeDisabled();
  const generate = screen.getByRole("button", {
    name: "Actualizar Vista Previa en Vivo",
  });
  if (profileMissing) {
    expect(generate).toBeDisabled();
    expect(download).toBeDisabled();
    await user.click(download);
    expect(saves).toBe(0);
    expect(httpClient.get).not.toHaveBeenCalledWith(
      expect.stringContaining("/export-docx"),
      expect.anything(),
    );
    expect(httpClient.put).not.toHaveBeenCalled();
    return;
  }
  await waitFor(() => expect(generate).toBeEnabled());
  await user.dblClick(generate);
  await screen.findByText(generatedSession.moments[0].activitiesDescription);
  await waitFor(() => expect(download).toBeEnabled());
  await user.click(download);
  await waitFor(() => expect(download).toBeEnabled());
  expect(saves).toBe(1);
  await user.click(download);
  await waitFor(() => expect(download).toBeEnabled());
  expect(saves).toBe(1);
  const title = container.querySelector(
    '[name="sessionTitle"]',
  ) as HTMLInputElement;
  await user.clear(title);
  await user.type(title, "Nuevo título de sesión editada");
  expect(download).toBeEnabled();
  expect(screen.getByText(/Contenido desactualizado/)).toBeInTheDocument();
  await user.click(generate);
  await waitFor(() => expect(saves).toBe(2));
  await waitFor(() => expect(generate).toBeEnabled());
  await user.click(download);
  await waitFor(() => expect(saves).toBe(2));
  expect(httpClient.post).toHaveBeenCalledWith(
    "/sessions/generate",
    expect.objectContaining({ sessionTitle: "Nuevo título de sesión editada" }),
    expect.objectContaining({ headers: { "Idempotency-Key": expect.any(String) } }),
  );
  await waitFor(() => expect(download).toBeEnabled());
  await user.click(screen.getByRole("button", { name: "1.°" }));
  expect(download).toBeEnabled();
  await waitFor(() =>
    expect(httpClient.get).toHaveBeenCalledWith("/curriculum/areas/COM/tree", {
      params: { grade_level: "FIRST" },
    }),
  );
  await user.click(generate);
  await waitFor(() => expect(saves).toBe(3));
  await waitFor(() => expect(generate).toBeEnabled());
  await user.click(download);
  await waitFor(() =>
    expect(httpClient.post).toHaveBeenCalledWith(
      "/sessions/generate",
      expect.objectContaining({
        gradeLevel: "FIRST",
        selectedCompetencies: [
          expect.objectContaining({ performanceId: "PERF_COM_01_1G" }),
        ],
      }),
      expect.objectContaining({ headers: { "Idempotency-Key": expect.any(String) } }),
    ),
  );
  expect(httpClient.put).not.toHaveBeenCalled();
});
