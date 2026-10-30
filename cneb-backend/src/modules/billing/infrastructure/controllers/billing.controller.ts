import { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "../../../../infrastructure/database/database.js";
import { KyselyWalletRepository } from "../repositories/kysely-wallet.repository.js";
import { GetWalletBalanceUseCase } from "../../application/get-wallet-balance.use-case.js";
import {
  authenticate,
} from "../../../../presentation/middlewares/auth-guard.js";

export async function billingRoutes(server: FastifyInstance) {
  const walletRepository = new KyselyWalletRepository(db);
  const getWalletBalanceUseCase = new GetWalletBalanceUseCase(walletRepository);

  server.get(
    "/wallets/me",
    { preHandler: [authenticate] },
    async (request: FastifyRequest) => {
      return getWalletBalanceUseCase.execute(request.user!.sub);
    },
  );

  // Legacy administrative writes are retired until the audited subscription use case exists.
}
