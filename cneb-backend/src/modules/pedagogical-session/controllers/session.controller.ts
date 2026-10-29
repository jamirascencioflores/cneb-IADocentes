import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../../infrastructure/database/database.js";
import { KyselyCurriculumRepository } from "../../curriculum/infrastructure/repositories/kysely-curriculum.repository.js";
import { GeminiLLMService } from "../infrastructure/services/gemini-llm.service.js";
import { NativeDocxGeneratorService } from "../infrastructure/services/native-docx-generator.service.js";
import { PreviewSessionUseCase } from "../application/preview-session.use-case.js";
import { GenerateSessionUseCase } from "../application/generate-session.use-case.js";
import { ExportSessionDocxUseCase } from "../application/export-session-docx.use-case.js";
import { generateSessionSchema } from "./session.schemas.js";
import { authenticate, authorize } from "../../../presentation/middlewares/auth-guard.js";
import { z } from "zod";

const sessionParamSchema = z.object({
  id: z.string().uuid(),
});

export async function sessionRoutes(server: FastifyInstance) {
  const curriculumRepo = new KyselyCurriculumRepository(db);
  const llmService = new GeminiLLMService();
  const docxGenerator = new NativeDocxGeneratorService();

  const previewUseCase = new PreviewSessionUseCase(llmService, curriculumRepo);
  const generateUseCase = new GenerateSessionUseCase(db, previewUseCase);
  const exportUseCase = new ExportSessionDocxUseCase(
    docxGenerator,
    db,
  );

  // A generation is persisted and charged exactly once, never saved by the browser.
  server.post(
    "/sessions/generate",
    { preHandler: [authenticate, authorize(["TEACHER"])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const key = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/).parse(request.headers["idempotency-key"]);
      const dto = generateSessionSchema.parse(request.body);
      const result = await generateUseCase.execute(request.user!, key, dto);
      reply.header("Cache-Control", "no-store");
      return reply.status(200).send(result);
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
