export interface CnebCapacity {
  id: string;
  title: string;
}

export interface CnebCompetency {
  id: string;
  code: string;
  title: string;
  description: string;
  capacities: CnebCapacity[];
  defaultPerformanceId: string;
  defaultPerformance: string;
}

export interface CnebAreaCurriculum {
  id: string;
  name: string;
  competencies: CnebCompetency[];
}

export const CNEB_CURRICULUM_DATA: Record<string, CnebAreaCurriculum> = {
  COM: {
    id: "COM",
    name: "Comunicación",
    competencies: [
      {
        id: "COM_C01",
        code: "C-01",
        title: "Se comunica oralmente en su lengua materna",
        description:
          "El estudiante interactúa estratégicamente, organiza ideas y reflexiona sobre recursos verbales y paraverbales en debates escolares.",
        capacities: [
          { id: "COM_CAP_01", title: "Obtiene información del texto oral" },
          {
            id: "COM_CAP_02",
            title: "Infiere e interpreta información del texto oral",
          },
          {
            id: "COM_CAP_03",
            title: "Adecúa, organiza y desarrolla las ideas de forma coherente",
          },
          {
            id: "COM_CAP_04",
            title:
              "Utiliza recursos no verbales y paraverbales de forma estratégica",
          },
          {
            id: "COM_CAP_05",
            title: "Interactúa estratégicamente con distintos interlocutores",
          },
          {
            id: "COM_CAP_06",
            title:
              "Reflexiona y evalúa la forma, contenido y contexto del texto oral",
          },
        ],
        defaultPerformanceId: "PERF_COM_01_3G",
        defaultPerformance:
          "Adecúa el texto oral a la situación comunicativa considerando el propósito, tono formal y recursos no verbales. Sustenta argumentos sólidos contrastando fuentes y respondiendo con réplicas asertivas.",
      },
      {
        id: "COM_C02",
        code: "C-02",
        title: "Lee diversos tipos de textos escritos en su lengua materna",
        description:
          "Identifica información explícita e implícita, deduce relaciones causales y sintetiza posturas críticas.",
        capacities: [
          { id: "COM_CAP_07", title: "Obtiene información del texto escrito" },
          {
            id: "COM_CAP_08",
            title: "Infiere e interpreta información del texto",
          },
          {
            id: "COM_CAP_09",
            title:
              "Reflexiona y evalúa la forma, el contenido y contexto del texto",
          },
        ],
        defaultPerformanceId: "PERF_COM_02_3G",
        defaultPerformance:
          "Identifica información explícita, relevante y complementaria en textos argumentativos y expositivos. Deduce relaciones lógicas y la intención del autor contrastando posturas.",
      },
      {
        id: "COM_C03",
        code: "C-03",
        title: "Escribe diversos tipos de textos en su lengua materna",
        description:
          "Planifica, redacta y revisa textos argumentativos y expositivos con adecuación gramatical.",
        capacities: [
          {
            id: "COM_CAP_10",
            title: "Adecúa el texto a la situación comunicativa",
          },
          {
            id: "COM_CAP_11",
            title:
              "Organiza y desarrolla las ideas de forma coherente y cohesionada",
          },
          {
            id: "COM_CAP_12",
            title:
              "Utiliza convenciones del lenguaje escrito de forma pertinente",
          },
          {
            id: "COM_CAP_13",
            title:
              "Reflexiona y evalúa la forma, el contenido y contexto del texto escrito",
          },
        ],
        defaultPerformanceId: "PERF_COM_03_1G",
        defaultPerformance:
          "Adecúa el texto a la situación comunicativa considerando el propósito comunicativo, tipo textual y algunas características del género discursivo, organizando ideas con conectores pertinentes.",
      },
    ],
  },
  EPT: {
    id: "EPT",
    name: "Educación para el Trabajo",
    competencies: [
      {
        id: "EPT_C01",
        code: "C-01",
        title: "Gestiona proyectos de emprendimiento económico o social",
        description:
          "Crea propuestas de valor, aplica habilidades técnicas, trabaja cooperativamente y evalúa resultados.",
        capacities: [
          { id: "EPT_CAP_01", title: "Crea propuestas de valor" },
          { id: "EPT_CAP_02", title: "Aplica habilidades técnicas" },
          {
            id: "EPT_CAP_03",
            title: "Trabaja cooperativamente para lograr objetivos y metas",
          },
          {
            id: "EPT_CAP_04",
            title: "Evalúa los resultados del proyecto de emprendimiento",
          },
        ],
        defaultPerformanceId: "PERF_EPT_01_3G",
        defaultPerformance:
          "Emplea habilidades técnicas para producir un bien o brindar servicios siendo responsable con el ambiente y teniendo en cuenta normas de seguridad en el trabajo.",
      },
    ],
  },
  MAT: {
    id: "MAT",
    name: "Matemática",
    competencies: [
      {
        id: "MAT_C01",
        code: "C-01",
        title: "Resuelve problemas de cantidad",
        description:
          "Comprende nociones numéricas, operaciones, estimaciones y estrategias de cálculo.",
        capacities: [
          {
            id: "MAT_CAP_01",
            title: "Traduce cantidades a expresiones numéricas",
          },
          {
            id: "MAT_CAP_02",
            title:
              "Comunica su comprensión sobre los números y las operaciones",
          },
          {
            id: "MAT_CAP_03",
            title: "Usa estrategias y procedimientos de estimación y cálculo",
          },
          {
            id: "MAT_CAP_04",
            title:
              "Argumenta afirmaciones sobre las relaciones numéricas y las operaciones",
          },
        ],
        defaultPerformanceId: "PERF_MAT_01_3G",
        defaultPerformance:
          "Establece relaciones entre datos y acciones de comparar, igualar y reiterar cantidades.",
      },
      {
        id: "MAT_C02",
        code: "C-02",
        title: "Resuelve problemas de regularidad, equivalencia y cambio",
        description:
          "Traduce regularidades a patrones, ecuaciones, inecuaciones y funciones.",
        capacities: [
          {
            id: "MAT_CAP_05",
            title:
              "Traduce datos y condiciones a expresiones algebraicas y gráficas",
          },
          {
            id: "MAT_CAP_06",
            title: "Comunica su comprensión sobre las relaciones algebraicas",
          },
          {
            id: "MAT_CAP_07",
            title:
              "Usa estrategias y procedimientos para encontrar equivalencias y reglas generales",
          },
          {
            id: "MAT_CAP_08",
            title:
              "Argumenta afirmaciones sobre relaciones de cambio y equivalencia",
          },
        ],
        defaultPerformanceId: "PERF_MAT_02_3G",
        defaultPerformance:
          "Traduce datos a expresiones algebraicas y funciones lineales para resolver situaciones problemáticas.",
      },
      {
        id: "MAT_C03",
        code: "C-03",
        title: "Resuelve problemas de forma, movimiento y localización",
        description:
          "Modela formas geométricas, sus relaciones, transformaciones y ubicación en el espacio.",
        capacities: [
          {
            id: "MAT_CAP_09",
            title:
              "Modela objetos con formas geométricas y sus transformaciones",
          },
          {
            id: "MAT_CAP_10",
            title:
              "Comunica su comprensión sobre las formas y relaciones geométricas",
          },
          {
            id: "MAT_CAP_11",
            title:
              "Usa estrategias y procedimientos para medir y orientarse en el espacio",
          },
          {
            id: "MAT_CAP_12",
            title: "Argumenta afirmaciones sobre relaciones geométricas",
          },
        ],
        defaultPerformanceId: "PERF_MAT_03_3G",
        defaultPerformance:
          "Modela características geométricas y relaciones de semejanza y congruencia en polígonos y planos.",
      },
      {
        id: "MAT_C04",
        code: "C-04",
        title: "Resuelve problemas de gestión de datos e incertidumbre",
        description:
          "Representa datos con gráficos, medidas estadísticas y probabilidades para tomar decisiones.",
        capacities: [
          {
            id: "MAT_CAP_13",
            title:
              "Representa datos con gráficos y medidas estadísticas o probabilísticas",
          },
          {
            id: "MAT_CAP_14",
            title:
              "Comunica su comprensión de los conceptos estadísticos y probabilísticos",
          },
          {
            id: "MAT_CAP_15",
            title:
              "Usa estrategias y procedimientos para recopilar y procesar datos",
          },
          {
            id: "MAT_CAP_16",
            title:
              "Sustenta conclusiones o decisiones con base en la información obtenida",
          },
        ],
        defaultPerformanceId: "PERF_MAT_04_3G",
        defaultPerformance:
          "Representa el comportamiento de datos mediante gráficos estadísticos y medidas de tendencia central.",
      },
    ],
  },
};
