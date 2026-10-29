import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExportSessionDocxUseCase } from "./export-session-docx.use-case.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../../core/errors/app-error.js";

const snapshot = { teacherFullName: "Ana Original", specialty: "Comunicación",
  schoolName: "Escuela Original", ugel: "UGEL 01", dre: "DRE original",
  principalName: null, badgeUrl: null, signatureUrl: null };
describe("persisted DOCX exports", () => {
  let db: any;
  let compile: any;
  let session: any;
  let profile: any;
  let useCase: ExportSessionDocxUseCase;
  beforeEach(() => {
    session = { id: "session-1", user_id: "teacher-1", session_title: "Sesión",
      area_id: "COM", sections: '["A"]', institutional_snapshot: snapshot };
    profile = { id: "profile-1", user_id: "teacher-1", teacher_full_name: "Nombre corregido",
      school_name: "Otra escuela", is_default: true, created_at: new Date() };
    db = { selectFrom: vi.fn((table: string) => ({
      selectAll() { return this; }, select() { return this; }, where() { return this; },
      innerJoin() { return this; }, orderBy() { return this; },
      executeTakeFirst: async () => table === "learning_sessions" ? session
        : table === "institutional_profiles" ? profile : undefined,
      execute: async () => [],
    })), transaction: vi.fn(), updateTable: vi.fn(), insertInto: vi.fn() };
    compile = vi.fn().mockResolvedValue(Buffer.from("docx"));
    useCase = new ExportSessionDocxUseCase({ compile }, db);
  });
  it("repeated downloads use original identity and never access a wallet or write to the database", async () => {
    for (let i = 0; i < 2; i++) {
      expect((await useCase.execute({ sessionId: "session-1", userId: "teacher-1" })).fileBuffer).toBeDefined();
    }
    expect(compile).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(snapshot));
    expect(db.selectFrom).not.toHaveBeenCalledWith("credit_wallets");
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.insertInto).not.toHaveBeenCalled();
    expect(db.updateTable).not.toHaveBeenCalled();
  });
  it("rejects a missing current institutional profile", async () => {
    profile = undefined;
    await expect(useCase.execute({ sessionId: "session-1", userId: "teacher-1" })).rejects.toThrow(NotFoundError);
    expect(compile).not.toHaveBeenCalled();
  });
  it("never invents the identity of a legacy session without a snapshot", async () => {
    session.institutional_snapshot = null;
    await expect(useCase.execute({ sessionId: "session-1", userId: "teacher-1" })).rejects.toThrow(ConflictError);
  });
  it("rejects a session owned by another teacher", async () => {
    await expect(useCase.execute({ sessionId: "session-1", userId: "another" })).rejects.toThrow(ForbiddenError);
  });
});
