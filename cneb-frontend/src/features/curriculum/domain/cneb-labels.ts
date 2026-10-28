import {
  GradeLevel,
  PedagogicalDuration,
  DidacticMomentType,
  InstrumentType,
} from "@/features/sessions/domain/session.types";

export const GRADE_LABEL_MAP: Record<GradeLevel, string> = {
  FIRST: "1.° de Secundaria",
  SECOND: "2.° de Secundaria",
  THIRD: "3.° de Secundaria",
  FOURTH: "4.° de Secundaria",
  FIFTH: "5.° de Secundaria",
};

export const DURATION_LABEL_MAP: Record<PedagogicalDuration, string> = {
  MINUTES_45: "45 min (1 h.p.)",
  MINUTES_90: "90 min (2 h.p.)",
  MINUTES_135: "135 min (3 h.p.)",
};

export const AREA_NAME_MAP: Record<string, string> = {
  COM: "Comunicación",
  EPT: "Educación para el Trabajo",
  MAT: "Matemática",
  CCSS: "Ciencias Sociales",
  CYT: "Ciencia y Tecnología",
  DPCC: "Desarrollo Personal, Ciudadanía y Cívica",
};

export const MOMENT_LABEL_MAP: Record<DidacticMomentType, string> = {
  START: "INICIO",
  DEVELOPMENT: "DESARROLLO",
  CLOSING: "CIERRE",
};

export const INSTRUMENT_LABEL_MAP: Record<InstrumentType, string> = {
  CHECKLIST: "Lista de cotejo",
  RUBRIC: "Rúbrica de evaluación",
  SELF_EVALUATION: "Ficha de autoevaluación",
  OBSERVATION_GUIDE: "Guía de observación",
  NONE: "Sin instrumento",
};

export const DUA_CATEGORY_DETAILS: Record<
  string,
  { principle: string; note: string }
> = {
  "Apoyos visuales estructurados": {
    principle: "Principio de Representación",
    note: "Organizadores gráficos y esquemas con conectores lógicos para apoyar la comprensión.",
  },
  "Consignas y tiempos escalonados": {
    principle: "Principio de Acción y Expresión",
    note: "Segmentación de la tarea en micro-pasos guiados de 3 a 5 min con metas escalonadas.",
  },
  "Dinámicas neurodidácticas": {
    principle: "Principio de Implicación / Compromiso",
    note: "Pausas activas y activación lúdica de saberes previos mediante tarjetas de posturas.",
  },
  "Múltiples formatos de expresión": {
    principle: "Principio de Acción y Expresión",
    note: "Opciones de respuesta oral, gráfica o síntesis escrita antes del producto final.",
  },
};
