/// <reference types="node" />
import { webcrypto } from "node:crypto";
import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionPreview } from "./useSessionPreview";
import { GENERATION_PENDING_TTL_MS } from "./pending-generation";
import { initialFormValues } from "./useSessionDraftForm";
import { SessionMapper } from "../infrastructure/session.mapper";
import { generatedSession } from "@/test/session-preview.fixture";
import { sessionRepository } from "../infrastructure/http-session.repository";
import { ApiProblemException, type ProblemDetails } from "@/shared/types/problem-details.types";

vi.mock("../infrastructure/http-session.repository", () => ({
  sessionRepository: { generatePreview: vi.fn() },
}));
const generated = SessionMapper.toDomainEntity({
  ...generatedSession, id: "00000000-0000-4000-8000-000000000001",
}, initialFormValues);
function apiProblem(status: number, detail: string): ApiProblemException {
  const problem: ProblemDetails = {
    type: "about:blank", title: "No se pudo completar la generación", status, detail,
  };
  return new ApiProblemException(problem);
}
function mount(userId = "teacher-1") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useSessionPreview(userId), { wrapper });
}
async function attempt(mounted: ReturnType<typeof mount>) {
  let error: unknown;
  await act(async () => { try { await mounted.result.current.mutateAsync(initialFormValues); } catch (reason) { error = reason; } });
  return error;
}
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  sessionStorage.clear();
  vi.mocked(sessionRepository.generatePreview).mockReset();
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("browser-persistent generation idempotency", () => {
  it("recovers the same key after recreating the hook and removes it only after COMPLETED", async () => {
    vi.mocked(sessionRepository.generatePreview).mockRejectedValueOnce(apiProblem(503, "Connection lost"))
      .mockResolvedValueOnce(generated);
    const first = mount();
    await attempt(first);
    const storageKey = sessionStorage.key(0)!;
    const saved = JSON.parse(sessionStorage.getItem(storageKey)!);
    expect(saved).toMatchObject({ state: "PENDING", createdAt: expect.any(Number), fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(sessionStorage.getItem(storageKey)).not.toContain(initialFormValues.sessionTitle);
    expect(storageKey).not.toContain("teacher-1");
    first.unmount();
    const reloaded = mount();
    await attempt(reloaded);
    const calls = vi.mocked(sessionRepository.generatePreview).mock.calls;
    expect(calls[0][1]).toBe(saved.idempotencyKey);
    expect(calls[1][1]).toBe(saved.idempotencyKey);
    expect(sessionStorage.length).toBe(0);
    await waitFor(() => expect(reloaded.result.current.data?.id).toBe(generated.id));
  });
  it("never reuses a key for another teacher or a different form fingerprint", async () => {
    vi.mocked(sessionRepository.generatePreview).mockRejectedValue(apiProblem(503, "Servicio no disponible."));
    const first = mount();
    await attempt(first);
    first.unmount();
    const another = mount("teacher-2");
    await attempt(another);
    another.unmount();
    const changed = mount();
    await act(async () => {
      await changed.result.current.mutateAsync({ ...initialFormValues, sessionTitle: "Otro título diferente" }).catch(() => undefined);
    });
    const keys = vi.mocked(sessionRepository.generatePreview).mock.calls.map((call) => call[1]);
    expect(new Set(keys).size).toBe(3);
    expect(sessionStorage.length).toBe(3);
  });
  it("expires the local pending lease after three minutes but reconciles its old key before allowing a new charge", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    vi.mocked(sessionRepository.generatePreview).mockRejectedValueOnce(apiProblem(503, "Respuesta perdida."))
      .mockRejectedValueOnce(apiProblem(503, "Respuesta incierta.")).mockResolvedValueOnce(generated);
    const first = mount();
    await attempt(first);
    const storageKey = sessionStorage.key(0)!;
    const original = JSON.parse(sessionStorage.getItem(storageKey)!);
    first.unmount();
    clock.mockReturnValue(now + GENERATION_PENDING_TTL_MS + 1);
    const recovered = mount();
    await attempt(recovered);
    expect(JSON.parse(sessionStorage.getItem(storageKey)!)).toMatchObject({
      idempotencyKey: original.idempotencyKey, createdAt: now, state: "EXPIRED",
    });
    await attempt(recovered);
    expect(vi.mocked(sessionRepository.generatePreview).mock.calls.map((call) => call[1]))
      .toEqual([original.idempotencyKey, original.idempotencyKey, original.idempotencyKey]);
    expect(sessionStorage.length).toBe(0);
  });
  it.each([
    { status: 400, detail: "Datos inválidos." },
    { status: 402, detail: "Saldo insuficiente." },
    { status: 404, detail: "Perfil institucional no encontrado." },
    { status: 422, detail: "La validación de la sesión falló." },
    { status: 409, detail: "Esta generación falló sin cobro. Inicia otro intento con una clave nueva." },
    { status: 409, detail: "La generación se interrumpió sin cobro. Usa una clave nueva." },
    { status: 409, detail: "La generación fue interrumpida sin cobro." },
    { status: 409, detail: "El intento ya no está vigente; no se realizó ningún cobro." },
    { status: 409, detail: "Idempotency-Key ya utilizada con otro contenido." },
    { status: 409, detail: "La misma Idempotency-Key se reutilizó con contenido diferente." },
  ])("clears ApiProblemException $status: $detail", async ({ status, detail }) => {
    const error = apiProblem(status, detail);
    expect(error).toBeInstanceOf(ApiProblemException);
    vi.mocked(sessionRepository.generatePreview).mockRejectedValue(error);
    const hook = mount();
    await attempt(hook);
    expect(sessionStorage.length).toBe(0);
  });
  it.each([
    apiProblem(401, "La sesión necesita renovarse."),
    apiProblem(500, "Error interno; resultado incierto."),
    apiProblem(502, "Respuesta perdida."),
    apiProblem(503, "Servicio no disponible."),
    apiProblem(504, "Se agotó el tiempo de espera."),
    apiProblem(409, "La generación sigue en progreso. Reintenta con la misma clave."),
    apiProblem(409, "No se pudo confirmar el resultado de la generación."),
    apiProblem(409, "Hay otro contenido pendiente, sin información sobre el cobro."),
    new TypeError("Failed to fetch"),
    new DOMException("La solicitud agotó el tiempo de espera.", "TimeoutError"),
  ])("preserves uncertain errors and in-progress results: %s", async (error) => {
    vi.mocked(sessionRepository.generatePreview).mockRejectedValue(error);
    await attempt(mount());
    expect(sessionStorage.length).toBe(1);
  });
  it("prioritizes problem.status and problem.detail over conflicting flat fields", async () => {
    const error = Object.assign(apiProblem(409, "La generación sigue en progreso."), {
      status: 400, message: "La generación falló sin cobro.",
    });
    vi.mocked(sessionRepository.generatePreview).mockRejectedValue(error);
    await attempt(mount());
    expect(sessionStorage.length).toBe(1);
  });
  it("does not use an uncertain 409 title as proof that no charge occurred", async () => {
    const problem: ProblemDetails = {
      type: "about:blank", status: 409, title: "La generación falló sin cobro.", detail: "",
    };
    vi.mocked(sessionRepository.generatePreview).mockRejectedValue(new ApiProblemException(problem));
    await attempt(mount());
    expect(sessionStorage.length).toBe(1);
  });
  it("retains defensive support for flat status/message errors", async () => {
    vi.mocked(sessionRepository.generatePreview).mockRejectedValue({
      status: 409, message: "Idempotency-Key ya utilizada con otro contenido.",
    });
    await attempt(mount());
    expect(sessionStorage.length).toBe(0);
  });
  it("never calls the backend if it cannot persist the key", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    const error = await attempt(mount());
    expect(error).toBeInstanceOf(Error);
    expect(sessionRepository.generatePreview).not.toHaveBeenCalled();
  });
  it("does not discard a charged result when local cleanup fails", async () => {
    vi.mocked(sessionRepository.generatePreview).mockResolvedValue(generated);
    const cleanupSpy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    const hook = mount();
    expect(await attempt(hook)).toBeUndefined();
    await waitFor(() => expect(hook.result.current.data?.id).toBe(generated.id));
    cleanupSpy.mockRestore();
  });
});
