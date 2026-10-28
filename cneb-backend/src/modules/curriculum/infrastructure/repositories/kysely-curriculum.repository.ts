import { Kysely } from "kysely";
import {
  DatabaseSchema,
  GradeLevelEnum,
} from "../../../../infrastructure/database/types.js";
import {
  AreaDTO,
  CurriculumTreeDTO,
  ICurriculumRepository,
} from "../../domain/curriculum.repository.interface.js";

export class KyselyCurriculumRepository implements ICurriculumRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  public async listActiveAreas(): Promise<AreaDTO[]> {
    const rows = await this.db
      .selectFrom("areas")
      .select(["id", "name", "cycle"])
      .where("is_active", "=", true)
      .orderBy("name", "asc")
      .execute();

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      cycle: r.cycle,
    }));
  }

  public async getCurriculumTree(
    areaId: string,
    gradeLevel: string,
  ): Promise<CurriculumTreeDTO | null> {
    const area = await this.db
      .selectFrom("areas")
      .select(["id", "name"])
      .where("id", "=", areaId)
      .where("is_active", "=", true)
      .executeTakeFirst();

    if (!area) return null;

    const competencies = await this.db
      .selectFrom("competencies")
      .selectAll()
      .where("area_id", "=", areaId)
      .execute();

    if (competencies.length === 0) {
      return {
        areaId: area.id,
        areaName: area.name,
        gradeLevel,
        competencies: [],
      };
    }

    const competencyIds = competencies.map((c) => c.id);

    const capacities = await this.db
      .selectFrom("capacities")
      .selectAll()
      .where("competency_id", "in", competencyIds)
      .orderBy("order_index", "asc")
      .execute();

    const performances = await this.db
      .selectFrom("performances")
      .selectAll()
      .where("competency_id", "in", competencyIds)
      .where("grade_level", "=", gradeLevel as GradeLevelEnum)
      .execute();

    const competencyTree = competencies.map((comp) => ({
      id: comp.id,
      title: comp.title,
      description: comp.description,
      capacities: capacities
        .filter((cap) => cap.competency_id === comp.id)
        .map((cap) => ({
          id: cap.id,
          title: cap.title,
          orderIndex: cap.order_index,
        })),
      performances: performances
        .filter((perf) => perf.competency_id === comp.id)
        .map((perf) => ({
          id: perf.id,
          standardDescription: perf.standard_description,
        })),
    }));

    return {
      areaId: area.id,
      areaName: area.name,
      gradeLevel,
      competencies: competencyTree,
    };
  }
}
