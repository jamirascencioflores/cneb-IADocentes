import { Kysely } from "kysely";
import { DatabaseSchema } from "../../../infrastructure/database/types.js";
import { NotFoundError } from "../../../core/errors/app-error.js";
import { IWalletRepository } from "../domain/wallet.repository.interface.js";
import { SubscriptionPlan } from "../domain/credit-wallet.entity.js";

export interface AdjustSubscriptionDTO {
  targetUserId: string;
  planType?: SubscriptionPlan | undefined;
  balanceAdjustment?: number | undefined;
  isUnlimited?: boolean | undefined;
  expiresAt?: Date | null | undefined;
  note?: string | undefined;
}

export class AdjustUserSubscriptionUseCase {
  constructor(
    private readonly walletRepository: IWalletRepository,
    private readonly db: Kysely<DatabaseSchema>,
  ) {}

  public async execute(dto: AdjustSubscriptionDTO): Promise<{
    walletId: string;
    newBalance: number;
    planType: string;
    isUnlimited: boolean;
    expiresAt: Date | null;
  }> {
    return this.db.transaction().execute(async (trx) => {
      const wallet = await this.walletRepository.findByUserIdForUpdate(
        dto.targetUserId,
        trx,
      );
      if (!wallet) {
        throw new NotFoundError(
          "No se encontró billetera asociada al usuario.",
        );
      }

      const prevBalance = wallet.balance;
      wallet.applyManualAdjustment(
        dto.balanceAdjustment ?? 0,
        dto.planType,
        dto.expiresAt,
        dto.isUnlimited,
      );

      await this.walletRepository.update(wallet, trx);

      if (dto.balanceAdjustment !== undefined && dto.balanceAdjustment !== 0) {
        await this.walletRepository.recordTransaction(
          {
            walletId: wallet.id,
            amount: dto.balanceAdjustment,
            transactionType: "ADMIN_MANUAL_ADJUSTMENT",
            note:
              dto.note ??
              `Ajuste manual de créditos: ${prevBalance} -> ${wallet.balance}`,
          },
          trx,
        );
      }

      return {
        walletId: wallet.id,
        newBalance: wallet.balance,
        planType: wallet.planType,
        isUnlimited: wallet.isUnlimited,
        expiresAt: wallet.expiresAt,
      };
    });
  }
}
