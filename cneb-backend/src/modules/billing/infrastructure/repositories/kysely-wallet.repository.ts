import { Kysely, Transaction } from "kysely";
import {
  DatabaseSchema,
  TransactionTypeEnum,
} from "../../../../infrastructure/database/types.js";
import { IWalletRepository } from "../../domain/wallet.repository.interface.js";
import {
  CreditWallet,
  TransactionType,
} from "../../domain/credit-wallet.entity.js";

export class KyselyWalletRepository implements IWalletRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  private getExecutor(tx?: unknown) {
    return (tx as Transaction<DatabaseSchema>) ?? this.db;
  }

  public async findByUserId(userId: string): Promise<CreditWallet | null> {
    const row = await this.db
      .selectFrom("credit_wallets")
      .selectAll()
      .where("user_id", "=", userId)
      .executeTakeFirst();

    if (!row) return null;

    return CreditWallet.reconstitute({
      id: row.id,
      userId: row.user_id,
      balance: row.balance,
      isUnlimited: row.is_unlimited,
      planType: row.plan_type,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  public async findByUserIdForUpdate(
    userId: string,
    tx: unknown,
  ): Promise<CreditWallet | null> {
    const executor = this.getExecutor(tx);
    const row = await executor
      .selectFrom("credit_wallets")
      .selectAll()
      .where("user_id", "=", userId)
      .forUpdate()
      .executeTakeFirst();

    if (!row) return null;

    return CreditWallet.reconstitute({
      id: row.id,
      userId: row.user_id,
      balance: row.balance,
      isUnlimited: row.is_unlimited,
      planType: row.plan_type,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  public async update(wallet: CreditWallet, tx?: unknown): Promise<void> {
    const executor = this.getExecutor(tx);
    await executor
      .updateTable("credit_wallets")
      .set({
        balance: wallet.balance,
        is_unlimited: wallet.isUnlimited,
        plan_type: wallet.planType,
        expires_at: wallet.expiresAt,
        updated_at: new Date(),
      })
      .where("id", "=", wallet.id)
      .execute();
  }

  public async recordTransaction(
    params: {
      walletId: string;
      amount: number;
      transactionType: TransactionType;
      referenceSessionId?: string | null;
      note?: string | null;
    },
    tx?: unknown,
  ): Promise<void> {
    const executor = this.getExecutor(tx);
    await executor
      .insertInto("wallet_transactions")
      .values({
        id: crypto.randomUUID(),
        wallet_id: params.walletId,
        amount: params.amount,
        transaction_type: params.transactionType as TransactionTypeEnum,
        reference_session_id: params.referenceSessionId ?? null,
        note: params.note ?? null,
      })
      .execute();
  }
}
