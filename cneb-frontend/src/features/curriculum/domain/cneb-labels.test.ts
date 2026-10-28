import { describe, it, expect } from "vitest";
import { INSTRUMENT_LABEL_MAP, MOMENT_LABEL_MAP } from "./cneb-labels";
import { CNEB_CURRICULUM_DATA } from "./cneb-curriculum.data";

describe("CNEB Labels & Curriculum Data", () => {
  it("debe mapear correctamente los momentos didácticos al español oficial", () => {
    expect(MOMENT_LABEL_MAP.START).toBe("INICIO");
    expect(MOMENT_LABEL_MAP.DEVELOPMENT).toBe("DESARROLLO");
    expect(MOMENT_LABEL_MAP.CLOSING).toBe("CIERRE");
  });

  it("debe contener las traducciones pedagógicas correctas para los instrumentos", () => {
    expect(INSTRUMENT_LABEL_MAP.CHECKLIST).toBe("Lista de cotejo");
    expect(INSTRUMENT_LABEL_MAP.RUBRIC).toBe("Rúbrica de evaluación");
  });

  it("debe incluir exactamente las 3 competencias de Comunicación", () => {
    const com = CNEB_CURRICULUM_DATA.COM;
    expect(com).toBeDefined();
    expect(com.competencies).toHaveLength(3);
    expect(com.competencies.map((c) => c.code)).toEqual([
      "C-01",
      "C-02",
      "C-03",
    ]);
  });

  it("debe incluir la competencia de EPT con sus 4 capacidades estándar", () => {
    const ept = CNEB_CURRICULUM_DATA.EPT;
    expect(ept).toBeDefined();
    expect(ept.competencies).toHaveLength(1);
    expect(ept.competencies[0].capacities).toHaveLength(4);
  });

  it("debe incluir las 4 competencias oficiales de Matemática", () => {
    const mat = CNEB_CURRICULUM_DATA.MAT;
    expect(mat).toBeDefined();
    expect(mat.competencies).toHaveLength(4);
  });
});
