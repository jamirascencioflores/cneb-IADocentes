import { it, expect, vi } from "vitest";
import { persistSnapshot } from "./session-snapshot";
import { SessionMapper } from "../infrastructure/session.mapper";
import { initialFormValues } from "./useSessionDraftForm";
import { generatedSession } from "@/test/session-preview.fixture";

it("reuses unchanged content but persists edits after the first download", async () => {
  const save = vi
    .fn()
    .mockResolvedValueOnce("version-1")
    .mockResolvedValueOnce("version-2");
  const preview = SessionMapper.toDomainEntity(
    generatedSession,
    initialFormValues,
  );
  const first = await persistSnapshot(preview, null, save);
  expect(await persistSnapshot(preview, first, save)).toEqual(first);
  const changed = await persistSnapshot(
    { ...preview, sessionTitle: "Título actualizado" },
    first,
    save,
  );
  expect(changed.id).toBe("version-2");
  expect(save).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenLastCalledWith(
    expect.objectContaining({ sessionTitle: "Título actualizado" }),
  );
});
