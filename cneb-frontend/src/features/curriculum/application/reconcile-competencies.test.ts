import { it, expect } from "vitest";
import { reconcileCompetencies } from "./reconcile-competencies";
import type { CurriculumTree } from "./useCurriculum";
const selected = [
  {
    competencyId: "COM_C01",
    performanceId: "PERF_3G",
    precisedPerformance: "Desempeño de tercero",
    isPrimary: true,
  },
];
const tree: CurriculumTree = {
  areaId: "COM",
  areaName: "Comunicación",
  gradeLevel: "FIRST",
  competencies: [
    {
      id: "COM_C01",
      title: "Oralidad",
      description: "",
      capacities: [],
      performances: [
        { id: "PERF_1G", standardDescription: "Desempeño de primero" },
      ],
    },
  ],
};
it("replaces a performance from another grade", () => {
  expect(reconcileCompetencies(selected, tree)[0]).toMatchObject({
    performanceId: "PERF_1G",
    precisedPerformance: "Desempeño de primero",
  });
});
it("does not invent a performance when the grade is missing", () => {
  expect(
    reconcileCompetencies(selected, {
      ...tree,
      competencies: [{ ...tree.competencies[0], performances: [] }],
    }),
  ).toEqual([]);
});
it("preserves teacher edits for the same grade", () => {
  expect(
    reconcileCompetencies(
      [
        {
          ...selected[0],
          performanceId: "PERF_1G",
          precisedPerformance: "Adaptación del docente",
        },
      ],
      tree,
    )[0].precisedPerformance,
  ).toBe("Adaptación del docente");
});
