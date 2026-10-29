import { Kysely } from "kysely";
import { DatabaseSchema } from "../../../infrastructure/database/types.js";
import { NotFoundError, ValidationError } from "../../../core/errors/app-error.js";
import { IWalletRepository } from "../domain/wallet.repository.interface.js";
import { SubscriptionPlan } from "../domain/credit-wallet.entity.js";

export interface AdjustSubscriptionDTO {
  targetUserId: string;
  actorUserId: string;
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
    if (!dto.note?.trim() || dto.note.trim().length > 255)
      throw new ValidationError("El motivo del ajuste es obligatorio y admite hasta 255 caracteres.");
    const note = dto.note.trim();
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
      const before = { plan: wallet.planType, expiry: wallet.expiresAt, unlimited: wallet.isUnlimited };
      wallet.applyManualAdjustment(
        dto.balanceAdjustment ?? 0,
        dto.planType,
        dto.expiresAt,
        dto.isUnlimited,
      );

      await this.walletRepository.update(wallet, trx);

      if (dto.balanceAdjustment || before.plan !== wallet.planType
        || before.expiry?.getTime() !== wallet.expiresAt?.getTime()
        || before.unlimited !== wallet.isUnlimited) {
        await this.walletRepository.recordTransaction(
          {
            walletId: wallet.id,
            amount: wallet.balance - prevBalance,
            actorUserId: dto.actorUserId,
            balanceBefore: prevBalance, balanceAfter: wallet.balance,
            planTypeBefore: before.plan, planTypeAfter: wallet.planType,
            expiresAtBefore: before.expiry, expiresAtAfter: wallet.expiresAt,
            isUnlimitedBefore: before.unlimited, isUnlimitedAfter: wallet.isUnlimited,
            transactionType: "ADMIN_MANUAL_ADJUSTMENT",
            note,
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
