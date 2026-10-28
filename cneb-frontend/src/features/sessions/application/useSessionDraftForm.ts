import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  SessionDraftFormData,
  SessionDraftFormSchema,
} from "../domain/session-form.schema";

export const initialFormValues: SessionDraftFormData = {
  areaId: "COM",
  gradeLevel: "THIRD",
  sections: ["A", "B"],
  pedagogicalDuration: "MINUTES_90",
  unitTitle:
    "Unidad de Aprendizaje N° 04: Comunicación asertiva y deliberación ciudadana en entornos digitales",
  materialsAndResources: [
    "Ficha de Trabajo (Anexo)",
    "Plumones para pizarra acrílica",
    "Cuaderno de trabajo",
    "Lapiceros",
  ],
  selectedCompetencies: [
    {
      competencyId: "COM_C01",
      performanceId: "PERF_COM_01_3G",
      precisedPerformance:
        "Adecúa el texto oral a la situación comunicativa considerando el propósito, tono formal y recursos no verbales. Sustenta argumentos sólidos contrastando fuentes y respondiendo con réplicas asertivas.",
      isPrimary: true,
    },
  ],
  crossCuttingTheme: "RIGHTS",
  crossCuttingValues:
    "Disposición a deliberar posturas ciudadanas con respeto a la libertad de expresión y escucha activa.",
  sessionTitle:
    "El debate argumentativo y la deliberación sobre el uso responsable de las redes sociales",
  hasDuaInclusion: true,
  duaCategories: [
    "Apoyos visuales estructurados",
    "Consignas y tiempos escalonados",
    "Dinámicas neurodidácticas",
    "Múltiples formatos de expresión",
  ],
  instrumentType: "CHECKLIST",
  appendTableToDocument: true,
};

export const useSessionDraftForm = () => {
  return useForm<SessionDraftFormData>({
    resolver: zodResolver(SessionDraftFormSchema),
    defaultValues: initialFormValues,
    mode: "onChange",
  });
};
