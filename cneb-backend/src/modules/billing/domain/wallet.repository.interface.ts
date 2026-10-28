import { CreditWallet, TransactionType } from "./credit-wallet.entity.js";

export interface IWalletRepository {
  findByUserId(userId: string): Promise<CreditWallet | null>;
  // Bloqueo pesimista para el caso de uso de exportación
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
    },
    tx?: unknown,
  ): Promise<void>;
}
