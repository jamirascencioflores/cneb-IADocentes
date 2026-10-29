import type { CurriculumTree } from "./useCurriculum";
import type { SelectedCompetencyItem } from "@/features/sessions/domain/session-form.schema";

export function reconcileCompetencies(
  selected: SelectedCompetencyItem[],
  tree: CurriculumTree,
): SelectedCompetencyItem[] {
  return selected
    .flatMap((item) => {
      const competency = tree.competencies.find(
        (c) => c.id === item.competencyId,
      );
      if (!competency) return [];
      const same = competency.performances.find(
        (p) => p.id === item.performanceId,
      );
      if (same) return [item];
      const performance = competency.performances[0];
      return performance
        ? [
            {
              ...item,
              performanceId: performance.id,
              precisedPerformance: performance.standardDescription,
            },
          ]
        : [];
    })
    .map((item, index) => ({ ...item, isPrimary: index === 0 }));
}
