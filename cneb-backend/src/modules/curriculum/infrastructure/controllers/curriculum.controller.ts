import { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "../../../../infrastructure/database/database.js";
import { KyselyCurriculumRepository } from "../repositories/kysely-curriculum.repository.js";
import { ListAreasUseCase } from "../../application/list-areas.use-case.js";
import { GetCurriculumTreeUseCase } from "../../application/get-curriculum-tree.use-case.js";
import {
  curriculumTreeParamsSchema,
  curriculumTreeQuerySchema,
} from "./curriculum.schemas.js";
import { authenticate } from "../../../../presentation/middlewares/auth-guard.js";

export async function curriculumRoutes(server: FastifyInstance) {
  const repository = new KyselyCurriculumRepository(db);
  const listAreasUseCase = new ListAreasUseCase(repository);
  const getCurriculumTreeUseCase = new GetCurriculumTreeUseCase(repository);

  // GET /api/v1/curriculum/areas
  server.get("/curriculum/areas", { preHandler: [authenticate] }, async () => {
    return listAreasUseCase.execute();
  });

  // GET /api/v1/curriculum/areas/:areaId/tree?grade_level=THIRD
  server.get(
    "/curriculum/areas/:areaId/tree",
    { preHandler: [authenticate] },
    async (request: FastifyRequest) => {
      const { areaId } = curriculumTreeParamsSchema.parse(request.params);
      const { grade_level } = curriculumTreeQuerySchema.parse(request.query);

      return getCurriculumTreeUseCase.execute(areaId, grade_level);
    },
  );
}
