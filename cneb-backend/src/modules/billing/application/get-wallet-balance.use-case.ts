import { NotFoundError } from "../../../core/errors/app-error.js";
import { IWalletRepository } from "../domain/wallet.repository.interface.js";

export class GetWalletBalanceUseCase {
  constructor(private readonly walletRepository: IWalletRepository) {}

  public async execute(userId: string) {
    const wallet = await this.walletRepository.findByUserId(userId);
    if (!wallet) {
      throw new NotFoundError("No se encontró billetera de créditos activa.");
    }

    return {
      balance: wallet.balance,
      isUnlimited: wallet.isUnlimited,
      planType: wallet.planType,
      expiresAt: wallet.expiresAt,
      canGenerate: wallet.canGenerateSession(),
    };
  }
}
