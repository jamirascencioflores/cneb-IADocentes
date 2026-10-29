import { describe, it, expect, vi, beforeEach } from "vitest";
import { SaveSessionUseCase, SaveSessionDTO } from "./save-session.use-case.js";
import { Kysely } from "kysely";
import { DatabaseSchema } from "../../../infrastructure/database/types.js";

describe("SaveSessionUseCase", () => {
  let mockDb: {
    transaction: () => {
      execute: (cb: (trx: unknown) => Promise<unknown>) => Promise<unknown>;
    };
  };
  let useCase: SaveSessionUseCase;
  const lookup = vi.fn();
  const insert = vi.fn();

  beforeEach(() => {
    lookup.mockResolvedValue({ id: "PERF-1" });
    insert.mockClear();
    const trxChain = {
      selectFrom: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: lookup,
      insertInto: insert.mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      transaction: () => ({
        execute: async (callback: (trx: unknown) => Promise<unknown>) =>
          callback(trxChain),
      }),
    };

    useCase = new SaveSessionUseCase(
      mockDb as unknown as Kysely<DatabaseSchema>,
    );
  });

  it("debe ejecutar la transacción y devolver el UUID de la sesión guardada", async () => {
    const dto: SaveSessionDTO = {
      userId: "user-docente-uuid",
      areaId: "COM",
      gradeLevel: "THIRD",
      sections: ["A"],
      pedagogicalDuration: "MINUTES_45",
      unitTitle: "Unidad de Comunicación",
      sessionTitle: "Lectura crítica",
      learningPurpose: "Propósito pedagógico",
      evidenceDescription: "Evidencia formativa",
      crossCuttingTheme: "INTERCULTURAL",
      crossCuttingValues: "Respeto",
      hasDuaInclusion: false,
      materialsAndResources: ["Ficha de lectura"],
      evaluationDeclaration: "Lista de cotejo",
      competencies: [
        {
          competencyId: "COM-C1",
          performanceId: "PERF-1",
          precisedPerformance: "Desempeño precisado",
          isPrimary: true,
        },
      ],
      moments: [
        {
          momentType: "START",
          allocatedMinutes: 10,
          pedagogicalProcesses: "Motivación",
          activitiesDescription: "Inicio de clase",
          duaNotes: null,
          orderIndex: 1,
        },
        {
          momentType: "DEVELOPMENT",
          allocatedMinutes: 30,
          pedagogicalProcesses: "Desarrollo",
          activitiesDescription: "Lectura activa",
          duaNotes: null,
          orderIndex: 2,
        },
        {
          momentType: "CLOSING",
          allocatedMinutes: 5,
          pedagogicalProcesses: "Metacognición",
          activitiesDescription: "Reflexión final",
          duaNotes: null,
          orderIndex: 3,
        },
      ],
      instrument: {
        instrumentType: "CHECKLIST",
        evaluatedEvidence: "Ficha de comprensión",
        appendTableToDocument: true,
        criteria: [
          "Criterio 1",
          "Criterio 2",
          "Criterio 3",
          "Criterio 4",
          "Criterio 5",
        ],
      },
    };

    const result = await useCase.execute(dto);

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("string");
    expect(lookup).toHaveBeenCalledOnce();
    insert.mockClear();
    lookup.mockResolvedValue(undefined);
    await expect(useCase.execute(dto)).rejects.toThrow(
      "El desempeño no corresponde",
    );
    expect(insert).not.toHaveBeenCalled();
    await expect(
      useCase.execute({
        ...dto,
        moments: dto.moments.map((m) => ({ ...m, allocatedMinutes: 1 })),
      }),
    ).rejects.toThrow("Distribución temporal inválida");
  });
});
