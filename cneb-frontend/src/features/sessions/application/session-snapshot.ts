import type { SessionPreviewEntity } from "../domain/session.types";
import { SessionMapper } from "../infrastructure/session.mapper";

export interface SavedSnapshot {
  fingerprint: string;
  id: string;
}
export async function persistSnapshot(
  preview: SessionPreviewEntity,
  saved: SavedSnapshot | null,
  save: (preview: SessionPreviewEntity) => Promise<string>,
): Promise<SavedSnapshot> {
  const fingerprint = JSON.stringify(SessionMapper.toSaveSessionDTO(preview));
  if (saved?.fingerprint === fingerprint) return saved;
  return { fingerprint, id: await save(preview) };
}
