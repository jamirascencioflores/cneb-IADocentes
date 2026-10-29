import { useQuery } from "@tanstack/react-query";
import { httpClient } from "@/shared/lib/http-client";

export interface CurriculumTree {
  areaId: string;
  areaName: string;
  gradeLevel: string;
  competencies: Array<{
    id: string;
    title: string;
    description: string;
    capacities: Array<{ id: string; title: string; orderIndex: number }>;
    performances: Array<{ id: string; standardDescription: string }>;
  }>;
}

export function useCurriculum(areaId: string, gradeLevel: string) {
  return useQuery({
    queryKey: ["curriculum", areaId, gradeLevel],
    queryFn: async () =>
      (
        await httpClient.get<CurriculumTree>(
          `/curriculum/areas/${encodeURIComponent(areaId)}/tree`,
          {
            params: { grade_level: gradeLevel },
          },
        )
      ).data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCurriculumAreas() {
  return useQuery({
    queryKey: ["curriculum", "areas"],
    queryFn: async () =>
      (
        await httpClient.get<
          Array<{ id: string; name: string; cycle: string }>
        >("/curriculum/areas")
      ).data,
    staleTime: 5 * 60 * 1000,
  });
}
