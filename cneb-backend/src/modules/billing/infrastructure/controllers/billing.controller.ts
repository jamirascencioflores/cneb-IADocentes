import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../../../infrastructure/database/database.js";
import { KyselyWalletRepository } from "../repositories/kysely-wallet.repository.js";
import { AdjustUserSubscriptionUseCase } from "../../application/adjust-user-subscription.use-case.js";
import { GetWalletBalanceUseCase } from "../../application/get-wallet-balance.use-case.js";
import {
  adjustSubscriptionSchema,
  userIdParamSchema,
} from "./billing.schemas.js";
import {
  authenticate,
  authorize,
} from "../../../../presentation/middlewares/auth-guard.js";

export async function billingRoutes(server: FastifyInstance) {
  const walletRepository = new KyselyWalletRepository(db);
  const adjustSubscriptionUseCase = new AdjustUserSubscriptionUseCase(
    walletRepository,
    db,
  );
  const getWalletBalanceUseCase = new GetWalletBalanceUseCase(walletRepository);

  server.get(
    "/wallets/me",
    { preHandler: [authenticate] },
    async (request: FastifyRequest) => {
      return getWalletBalanceUseCase.execute(request.user!.sub);
    },
  );

  server.patch(
    "/admin/users/:id/subscription",
    { preHandler: [authenticate, authorize(["SUPERADMIN"])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = userIdParamSchema.parse(request.params);
      const dto = adjustSubscriptionSchema.parse(request.body);

      const result = await adjustSubscriptionUseCase.execute({
        targetUserId: id,
        actorUserId: request.user!.sub,
        planType: dto.planType,
        balanceAdjustment: dto.balanceAdjustment,
        isUnlimited: dto.isUnlimited,
        expiresAt: dto.expiresAt,
        note: dto.note,
      });

      return reply.status(200).send(result);
    },
  );
}
