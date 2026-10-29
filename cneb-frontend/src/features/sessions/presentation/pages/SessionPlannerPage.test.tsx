import { webcrypto } from "node:crypto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { UseFormReturn } from "react-hook-form";
import type { SessionDraftFormData } from "../../domain/session-form.schema";
import { initialFormValues } from "../../application/useSessionDraftForm";
import { SessionMapper } from "../../infrastructure/session.mapper";
import { generatedSession } from "@/test/session-preview.fixture";
import { sessionRepository } from "../../infrastructure/http-session.repository";
import { SessionPlannerPage } from "./SessionPlannerPage";

const controls = vi.hoisted(() => ({ form: undefined as UseFormReturn<SessionDraftFormData> | undefined }));
vi.mock("../../infrastructure/http-session.repository", () => ({
  sessionRepository: { generatePreview: vi.fn(), downloadDocx: vi.fn() },
}));
vi.mock("@/features/profile/application/useTeacherContext", () => ({
  useTeacherContext: () => ({
    user: { id: "teacher-1" }, institution: { teacherFullName: "Ana Docente", schoolName: "Escuela", ugel: "UGEL", drelm: "DRE" },
    profileMissing: false, profileMessage: null, isLoading: false, error: null,
  }),
}));
vi.mock("@/features/profile/presentation/components/TeacherNavbar", () => ({ TeacherNavbar: () => null }));
vi.mock("@/features/curriculum/application/useCurriculum", () => {
  const data = { areaName: "Comunicación", competencies: [{
    id: "COM_C01", title: "Competencia oficial", capacities: [], performances: [{ id: "PERF_COM_01_3G", standardDescription: "Desempeño" }],
  }] };
  return { useCurriculum: () => ({ data, isSuccess: true, isPending: false, isError: false }) };
});
vi.mock("../components/Step1GeneralData", () => ({
  Step1GeneralData: ({ form }: { form: UseFormReturn<SessionDraftFormData> }) => {
    controls.form = form;
    return <input aria-label="Título actual" {...form.register("sessionTitle")} />;
  },
}));
vi.mock("../components/Step2Competencies", () => ({ Step2Competencies: () => null }));
vi.mock("../components/Step3DuaAndInstrument", () => ({ Step3DuaAndInstrument: () => null }));
afterEach(() => {
  cleanup(); sessionStorage.clear(); controls.form = undefined;
  vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals();
});

it("keeps a charged result visible and downloadable when the form changes during the pending generation", async () => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:test"; } static revokeObjectURL() {} });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  const generated = SessionMapper.toDomainEntity({
    ...generatedSession, id: "00000000-0000-4000-8000-000000000001",
    institutionalProfile: { teacherFullName: "Ana Original", specialty: "Comunicación", schoolName: "Escuela original",
      ugel: "UGEL original", dre: "DRE original", principalName: null, badgeUrl: null, signatureUrl: null },
  }, initialFormValues);
  let resolve!: (value: typeof generated) => void;
  vi.mocked(sessionRepository.generatePreview).mockImplementation(() => new Promise((done) => { resolve = done; }));
  vi.mocked(sessionRepository.downloadDocx).mockResolvedValue(new Blob(["docx"]));
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><SessionPlannerPage /></QueryClientProvider>);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actualizar Vista Previa en Vivo" }));
  await waitFor(() => expect(sessionRepository.generatePreview).toHaveBeenCalledOnce());
  expect(screen.getByLabelText("Título actual")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Restablecer Formulario" })).toBeDisabled();
  // External updates can bypass disabled fields; result retention must not depend on UI locking.
  act(() => { controls.form!.setValue("sessionTitle", "Título nuevo mientras Gemini responde"); });
  await act(async () => { resolve(generated); });
  expect(await screen.findByText(generatedSession.moments[0].activitiesDescription)).toBeVisible();
  expect(screen.getByText("“" + initialFormValues.sessionTitle + "”")).toBeVisible();
  expect(screen.getByText(/Contenido desactualizado/)).toBeVisible();
  expect(screen.getAllByText("Ana Original")[0]).toBeVisible();
  const download = screen.getByRole("button", { name: "Descargar Word (.docx)" });
  expect(download).toBeEnabled();
  await user.click(download);
  await waitFor(() => expect(sessionRepository.downloadDocx).toHaveBeenCalledWith(generated.id));
  expect(sessionRepository.generatePreview).toHaveBeenCalledOnce();
  // Even an invalid current form must not block the previously paid document.
  act(() => { controls.form!.setValue("sessionTitle", "x"); });
  await waitFor(() => expect(download).toBeEnabled());
  await user.click(download);
  await waitFor(() => expect(sessionRepository.downloadDocx).toHaveBeenCalledTimes(2));
});
