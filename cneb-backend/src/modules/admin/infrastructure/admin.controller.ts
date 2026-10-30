import type { FastifyInstance } from "fastify";
import { db } from "../../../infrastructure/database/database.js";
import { authenticate, authorize } from "../../../presentation/middlewares/auth-guard.js";
import { TemporaryCredentialService } from "../../identity/application/temporary-credential.service.js";
import { Argon2HashService } from "../../identity/infrastructure/security/hash.service.js";
import { CreateTeacherUseCase } from "../application/create-teacher.use-case.js";
import { createTeacherSchema } from "../domain/admin.contracts.js";
import { KyselyAdminUnitOfWork } from "./kysely-admin-unit-of-work.js";

export async function adminRoutes(server: FastifyInstance) {
  const create = new CreateTeacherUseCase(new KyselyAdminUnitOfWork(db), new TemporaryCredentialService(new Argon2HashService()));
  server.addHook("onRequest", authenticate);
  server.addHook("onRequest", authorize(["SUPERADMIN"]));
  server.addHook("onRequest", async (_request, reply) => { reply.header("Cache-Control", "no-store"); });
  server.post("/teachers", async (request, reply) => {
    const auth = request.user!;
    const result = await create.execute(createTeacherSchema.parse(request.body), {
      actor: { userId: auth.sub, sessionId: auth.sid, tokenVersion: auth.token_version }, requestId: request.id,
    });
    return reply.code(201).send(result);
  });
}
