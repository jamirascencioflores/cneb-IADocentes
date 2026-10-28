import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExportSessionDocxUseCase } from "./export-session-docx.use-case.js";
import { IWalletRepository } from "../../billing/domain/wallet.repository.interface.js";
import { IDocxGeneratorService } from "../domain/docx-generator.interface.js";
import { CreditWallet } from "../../billing/domain/credit-wallet.entity.js";
import {
  PaymentRequiredError,
  ForbiddenError,
} from "../../../core/errors/app-error.js";
import { Kysely } from "kysely";
import { DatabaseSchema } from "../../../infrastructure/database/types.js";

describe("ExportSessionDocxUseCase", () => {
  let walletRepository: IWalletRepository;
  let docxGenerator: IDocxGeneratorService;
  let mockDb: any;
  let useCase: ExportSessionDocxUseCase;

  beforeEach(() => {
    walletRepository = {
      findByUserId: vi.fn(),
      findByUserIdForUpdate: vi.fn(),
      update: vi.fn(),
      recordTransaction: vi.fn(),
    };

    docxGenerator = {
      compile: vi.fn().mockResolvedValue(Buffer.from("fake-docx-content")),
    };

    mockDb = {
      selectFrom: vi.fn().mockReturnValue({
        selectAll: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue({
          id: "session-123",
          user_id: "user-docente",
          session_title: "Sesion de Prueba",
          unit_title: "Unidad 1",
          area_id: "COM",
          grade_level: "THIRD",
          sections: '["A"]',
          pedagogical_duration: "MINUTES_45",
          learning_purpose: "Propósito",
          evidence_description: "Evidencia",
          cross_cutting_theme: "RIGHTS",
          cross_cutting_values: "Valores",
          has_dua_inclusion: false,
          materials_and_resources: ["Material 1"],
          evaluation_declaration: "Declaración",
        }),
        execute: vi.fn().mockResolvedValue([]),
      }),
      transaction: () => ({
        execute: async (cb: any) => cb({}),
      }),
    };

    useCase = new ExportSessionDocxUseCase(
      walletRepository,
      docxGenerator,
      mockDb as Kysely<DatabaseSchema>,
    );
  });

  it("debe exportar y debitar 1 crédito para cuentas regulares", async () => {
    const mockWallet = CreditWallet.reconstitute({
      id: "wallet-1",
      userId: "user-docente",
      balance: 3,
      isUnlimited: false,
      planType: "MONTHLY",
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(walletRepository, "findByUserIdForUpdate").mockResolvedValue(
      mockWallet,
    );

    const result = await useCase.execute({
      sessionId: "session-123",
      userId: "user-docente",
    });

    expect(result.fileBuffer).toBeDefined();
    expect(mockWallet.balance).toBe(2);
    expect(walletRepository.update).toHaveBeenCalledTimes(1);
    expect(walletRepository.recordTransaction).toHaveBeenCalledTimes(1);
  });

  it("debe abortar con PaymentRequiredError si el docente no tiene saldo", async () => {
    const emptyWallet = CreditWallet.reconstitute({
      id: "wallet-1",
      userId: "user-docente",
      balance: 0,
      isUnlimited: false,
      planType: "TRIAL",
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(walletRepository, "findByUserIdForUpdate").mockResolvedValue(
      emptyWallet,
    );

    await expect(
      useCase.execute({ sessionId: "session-123", userId: "user-docente" }),
    ).rejects.toThrow(PaymentRequiredError);
  });

  it("debe denegar acceso (ForbiddenError) si la sesión pertenece a otro usuario (BOLA/IDOR)", async () => {
    await expect(
      useCase.execute({ sessionId: "session-123", userId: "user-hacker" }),
    ).rejects.toThrow(ForbiddenError);
  });
});
