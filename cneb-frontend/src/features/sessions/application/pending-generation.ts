import type { SessionDraftFormData } from "../domain/session-form.schema";

// Matches the backend attempt lease. Expiry never proves that a commit did not occur.
export const GENERATION_PENDING_TTL_MS = 180_000;
const PREFIX = "cneb:generation:";
type PendingState = "PENDING" | "EXPIRED";
interface PendingGeneration {
  idempotencyKey: string;
  fingerprint: string;
  createdAt: number;
  state: PendingState;
}
export interface GenerationAttempt extends PendingGeneration { storageKey: string; }

async function digest(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function getGenerationAttempt(userId: string, form: SessionDraftFormData): Promise<GenerationAttempt> {
  if (!userId) throw new Error("No se pudo identificar al docente autenticado.");
  const [owner, fingerprint] = await Promise.all([digest(userId), digest(JSON.stringify(form))]);
  const storageKey = PREFIX + owner + ":" + fingerprint;
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw) {
      const saved: unknown = JSON.parse(raw);
      if (saved && typeof saved === "object" && "idempotencyKey" in saved
        && typeof saved.idempotencyKey === "string" && /^[\w-]{1,128}$/.test(saved.idempotencyKey)
        && "fingerprint" in saved && saved.fingerprint === fingerprint
        && "createdAt" in saved && typeof saved.createdAt === "number"
        && Number.isSafeInteger(saved.createdAt) && saved.createdAt >= 0
        && "state" in saved && (saved.state === "PENDING" || saved.state === "EXPIRED")) {
        const state = Date.now() - saved.createdAt >= GENERATION_PENDING_TTL_MS ? "EXPIRED" : "PENDING";
        const pending: PendingGeneration = {
          idempotencyKey: saved.idempotencyKey, fingerprint, createdAt: saved.createdAt, state,
        };
        sessionStorage.setItem(storageKey, JSON.stringify(pending));
        return { ...pending, storageKey };
      }
    }
    const pending: PendingGeneration = {
      idempotencyKey: crypto.randomUUID(), fingerprint, createdAt: Date.now(), state: "PENDING",
    };
    sessionStorage.setItem(storageKey, JSON.stringify(pending));
    return { ...pending, storageKey };
  } catch {
    throw new Error("No se pudo conservar el intento de generación. Habilita sessionStorage antes de generar.");
  }
}

export function clearGenerationAttempt(attempt: GenerationAttempt): void {
  // Cleanup failure must never hide a successfully charged response.
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(attempt.storageKey) ?? "null");
    if (saved && typeof saved === "object" && "idempotencyKey" in saved
      && saved.idempotencyKey === attempt.idempotencyKey) sessionStorage.removeItem(attempt.storageKey);
  } catch { /* A later retry can still recover the committed response. */ }
}

export function isDefinitiveGenerationFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const problem = "problem" in error && error.problem && typeof error.problem === "object"
    ? error.problem : null;
  // ApiProblemException and the HTTP client's problem envelope are authoritative.
  // Flat status/message are only a defensive fallback when no problem is present.
  const status = Number(problem
    ? ("status" in problem ? problem.status : undefined)
    : ("status" in error ? error.status : undefined));
  if ([400, 402, 404, 422].includes(status)) return true;
  const detail = problem
    ? ("detail" in problem && typeof problem.detail === "string" ? problem.detail : "")
    : ("message" in error && typeof error.message === "string" ? error.message : "");
  // Gateway errors, timeouts, auth renewal and generic conflicts may conceal a completed commit.
  return status === 409 && (
    /falló sin cobro|(?:se interrumpió|fue interrumpida) sin cobro|no se realizó ningún cobro/i.test(detail)
    || /Idempotency-Key.*(?:otro contenido|contenido diferente)/i.test(detail)
  );
}
