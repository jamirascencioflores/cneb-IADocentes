import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { httpClient } from "@/shared/lib/http-client";
import { generatedSession } from "./session-preview.fixture";

vi.mock("@/shared/lib/http-client", () => ({
  httpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("loads account data, generates, exports and persists edits with the selected grade", async () => {
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
    if (url === "/profile/institutional")
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
    if (url === "/sessions/preview") return { data: generatedSession };
    if (url === "/sessions")
      return { data: { id: `00000000-0000-4000-8000-00000000000${++saves}` } };
    throw new Error(`Unexpected POST ${url}`);
  });
  const user = userEvent.setup();
  const { container } = render(<App />);
  await screen.findAllByText("Ana Docente");
  const download = screen.getByRole("button", {
    name: "Descargar Word (.docx)",
  });
  expect(download).toBeDisabled();
  const generate = screen.getByRole("button", {
    name: "Actualizar Vista Previa en Vivo",
  });
  await waitFor(() => expect(generate).toBeEnabled());
  await user.click(generate);
  await screen.findByText(generatedSession.moments[0].activitiesDescription);
  await waitFor(() => expect(download).toBeEnabled());
  await user.click(download);
  await waitFor(() =>
    expect(httpClient.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        moments: expect.arrayContaining([
          expect.objectContaining({
            activitiesDescription:
              generatedSession.moments[0].activitiesDescription,
          }),
        ]),
      }),
    ),
  );
  await waitFor(() => expect(download).toBeEnabled());
  const title = container.querySelector(
    '[name="sessionTitle"]',
  ) as HTMLInputElement;
  await user.clear(title);
  await user.type(title, "Nuevo título de sesión editada");
  expect(download).toBeDisabled();
  await user.click(generate);
  await waitFor(() => expect(download).toBeEnabled());
  await user.click(download);
  await waitFor(() => expect(saves).toBe(2));
  expect(httpClient.post).toHaveBeenCalledWith(
    "/sessions",
    expect.objectContaining({ sessionTitle: "Nuevo título de sesión editada" }),
  );
  await waitFor(() => expect(download).toBeEnabled());
  await user.click(screen.getByRole("button", { name: "1.°" }));
  expect(download).toBeDisabled();
  await waitFor(() =>
    expect(httpClient.get).toHaveBeenCalledWith("/curriculum/areas/COM/tree", {
      params: { grade_level: "FIRST" },
    }),
  );
  await user.click(generate);
  await waitFor(() => expect(download).toBeEnabled());
  await user.click(download);
  await waitFor(() =>
    expect(httpClient.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        gradeLevel: "FIRST",
        competencies: [
          expect.objectContaining({ performanceId: "PERF_COM_01_1G" }),
        ],
      }),
    ),
  );
});
