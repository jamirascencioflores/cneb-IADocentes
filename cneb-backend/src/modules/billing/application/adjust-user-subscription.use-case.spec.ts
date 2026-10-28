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
  });
});
