import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdjustUserSubscriptionUseCase } from "./adjust-user-subscription.use-case.js";
import { IWalletRepository } from "../domain/wallet.repository.interface.js";
import { CreditWallet } from "../domain/credit-wallet.entity.js";
import { Kysely } from "kysely";
import { DatabaseSchema } from "../../../infrastructure/database/types.js";

describe("AdjustUserSubscriptionUseCase", () => {
  let walletRepository: IWalletRepository;
  let mockDb: unknown;
  let useCase: AdjustUserSubscriptionUseCase;

  beforeEach(() => {
    walletRepository = {
      findByUserId: vi.fn(),
      findByUserIdForUpdate: vi.fn(),
      update: vi.fn(),
      recordTransaction: vi.fn(),
    };

    mockDb = {
      transaction: () => ({
        execute: async (callback: (trx: unknown) => Promise<unknown>) =>
          callback({}),
      }),
    };

    useCase = new AdjustUserSubscriptionUseCase(
      walletRepository,
      mockDb as Kysely<DatabaseSchema>,
    );
  });

  it("debe otorgar plan LIFETIME_FREE sin vencimiento y con créditos ilimitados", async () => {
    const mockWallet = CreditWallet.reconstitute({
      id: "wallet-001",
      userId: "user-familia",
      balance: 0,
      isUnlimited: false,
      planType: "TRIAL",
      startsAt: new Date(),
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(walletRepository, "findByUserIdForUpdate").mockResolvedValue(
      mockWallet,
    );

    const result = await useCase.execute({
      targetUserId: "user-familia",
      actorUserId: "admin-1",
      planType: "LIFETIME_FREE",
      isUnlimited: true,
      balanceAdjustment: 9999,
      expiresAt: null,
      note: "Cuenta liberada vitalicia",
    });

    expect(result.isUnlimited).toBe(true);
    expect(result.planType).toBe("LIFETIME_FREE");
    expect(result.newBalance).toBe(9999);
    expect(result.expiresAt).toBeNull();
    expect(walletRepository.update).toHaveBeenCalledTimes(1);
    expect(walletRepository.recordTransaction).toHaveBeenCalledTimes(1);
    expect(walletRepository.recordTransaction).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "admin-1", balanceBefore: 0, balanceAfter: 9999,
      planTypeBefore: "TRIAL", planTypeAfter: "LIFETIME_FREE",
      isUnlimitedBefore: false, isUnlimitedAfter: true, expiresAtAfter: null,
    }), expect.anything());
  });
  it("records an audited zero-amount movement for plan-only changes", async () => {
    const wallet = CreditWallet.reconstitute({
      id: "wallet", userId: "teacher", balance: 3, isUnlimited: false, planType: "TRIAL",
      startsAt: new Date(), expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(), updatedAt: new Date(),
    });
    vi.mocked(walletRepository.findByUserIdForUpdate).mockResolvedValue(wallet);
    await useCase.execute({ targetUserId: "teacher", actorUserId: "admin", planType: "MONTHLY", note: "Cambio de plan" });
    expect(walletRepository.recordTransaction).toHaveBeenCalledWith(expect.objectContaining({
      amount: 0, actorUserId: "admin", balanceBefore: 3, balanceAfter: 3,
      planTypeBefore: "TRIAL", planTypeAfter: "MONTHLY",
    }), expect.anything());
  });
  it("requires a reason and rejects an excessive withdrawal without updating the wallet", async () => {
    const wallet = CreditWallet.reconstitute({
      id: "wallet", userId: "teacher", balance: 3, isUnlimited: false, planType: "TRIAL",
      startsAt: new Date(), expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(), updatedAt: new Date(),
    });
    vi.mocked(walletRepository.findByUserIdForUpdate).mockResolvedValue(wallet);
    await expect(useCase.execute({ targetUserId: "teacher", actorUserId: "admin", balanceAdjustment: 1, note: " " })).rejects.toThrow(/motivo/);
    await expect(useCase.execute({ targetUserId: "teacher", actorUserId: "admin", balanceAdjustment: -5, note: "Retiro" })).rejects.toThrow(/negativo/);
    expect(wallet.balance).toBe(3);
    expect(walletRepository.update).not.toHaveBeenCalled();
    expect(walletRepository.recordTransaction).not.toHaveBeenCalled();
  });
});
