import { CreditWallet, TransactionType, SubscriptionPlan } from "./credit-wallet.entity.js";

export interface IWalletRepository {
  findByUserId(userId: string): Promise<CreditWallet | null>;
  // Bloqueo pesimista para ajustes administrativos.
  findByUserIdForUpdate(
    userId: string,
    tx: unknown,
  ): Promise<CreditWallet | null>;
  update(wallet: CreditWallet, tx?: unknown): Promise<void>;
  recordTransaction(
    params: {
      walletId: string;
      amount: number;
      transactionType: TransactionType;
      referenceSessionId?: string | null;
      note?: string | null;
      actorUserId?: string;
      balanceBefore?: number;
      balanceAfter?: number;
      planTypeBefore?: SubscriptionPlan;
      planTypeAfter?: SubscriptionPlan;
      expiresAtBefore?: Date | null;
      expiresAtAfter?: Date | null;
      isUnlimitedBefore?: boolean;
      isUnlimitedAfter?: boolean;
    },
    tx?: unknown,
  ): Promise<void>;
}
