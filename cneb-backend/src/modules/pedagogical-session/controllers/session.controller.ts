import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../../infrastructure/database/database.js";
import { KyselyCurriculumRepository } from "../../curriculum/infrastructure/repositories/kysely-curriculum.repository.js";
import { KyselyWalletRepository } from "../../billing/infrastructure/repositories/kysely-wallet.repository.js";
import { GeminiLLMService } from "../infrastructure/services/gemini-llm.service.js";
import { NativeDocxGeneratorService } from "../infrastructure/services/native-docx-generator.service.js";
import { PreviewSessionUseCase } from "../application/preview-session.use-case.js";
import { SaveSessionUseCase } from "../application/save-session.use-case.js";
import { ExportSessionDocxUseCase } from "../application/export-session-docx.use-case.js";
import { previewSessionSchema, saveSessionSchema } from "./session.schemas.js";
import { authenticate } from "../../../presentation/middlewares/auth-guard.js";
import { z } from "zod";

const sessionParamSchema = z.object({
  id: z.string().uuid(),
});

export async function sessionRoutes(server: FastifyInstance) {
  const curriculumRepo = new KyselyCurriculumRepository(db);
  const walletRepo = new KyselyWalletRepository(db);
  const llmService = new GeminiLLMService();
  const docxGenerator = new NativeDocxGeneratorService();

  const previewUseCase = new PreviewSessionUseCase(llmService, curriculumRepo);
  const saveUseCase = new SaveSessionUseCase(db);
  const exportUseCase = new ExportSessionDocxUseCase(
    walletRepo,
    docxGenerator,
    db,
  );

  // POST /api/v1/sessions/preview
  server.post(
    "/sessions/preview",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = previewSessionSchema.parse(request.body);
      const result = await previewUseCase.execute(dto);
      return reply.status(200).send(result);
    },
  );

  // POST /api/v1/sessions
  server.post(
    "/sessions",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = saveSessionSchema.parse(request.body);
      const result = await saveUseCase.execute({
        userId: request.user!.sub,
        ...dto,
      });
      return reply.status(201).send(result);
    },
  );

  // GET /api/v1/sessions/:id/export-docx
  server.get(
    "/sessions/:id/export-docx",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = sessionParamSchema.parse(request.params);

      const { fileBuffer, fileName } = await exportUseCase.execute({
        sessionId: id,
        userId: request.user!.sub,
      });

      return reply
        .header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        .header("Content-Disposition", `attachment; filename="${fileName}"`)
        .send(fileBuffer);
    },
  );
}
