import { env } from "../../../../config/env.js";
import {
  GenerateSessionPromptInput,
  GeneratedSessionPayload,
  ILLMService,
} from "../../domain/llm-service.interface.js";
import { PedagogicalDuration } from "../../domain/pedagogical-duration.vo.js";
import { ValidationError } from "../../../../core/errors/app-error.js";

export class GeminiLLMService implements ILLMService {
  private readonly apiUrl: string;

  constructor() {
    this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${env.LLM_MODEL}:generateContent?key=${env.LLM_API_KEY}`;
  }

  public async generateSessionDraft(
    input: GenerateSessionPromptInput,
  ): Promise<GeneratedSessionPayload> {
    const durationVO = PedagogicalDuration.from(input.pedagogicalDuration);
    const distribution = durationVO.getDistribution();

    const systemPrompt = `Eres un asesor pedagógico experto en el Currículo Nacional de la Educación Básica (CNEB) del Perú y la RVM N° 094-2020-MINEDU.
Genera una sesión de aprendizaje rigurosa y contextualizada en formato JSON estricto.

Reglas obligatorias:
1. Distribución de tiempos estricta para ${distribution.total} minutos:
   - START: ${distribution.start.min}-${distribution.start.max} minutos.
   - DEVELOPMENT: ${distribution.development.min}-${distribution.development.max} minutos.
   - CLOSING: ${distribution.closing.min}-${distribution.closing.max} minutos.
   La suma de los minutos DEBE ser exactamente ${distribution.total}.
2. Inclusión DUA (${input.hasDuaInclusion ? "ACTIVA" : "INACTIVA"}):
   ${
     input.hasDuaInclusion
       ? "Inserta dentro de activitiesDescription pautas DUA marcadas como [DUA — Principio de Representación] o [DUA — Principio de Acción y Expresión]."
       : "No agregues pautas DUA adicionales."
   }
3. Criterios de evaluación: Debes devolver un arreglo de EXACTAMENTE 5 criterios de evaluación observables redactados en tercera persona, derivados directamente del desempeño.
4. Responde ÚNICAMENTE un objeto JSON válido con este esquema:
{
  "learningPurpose": "string",
  "evidenceDescription": "string",
  "crossCuttingValues": "string",
  "evaluationDeclaration": "string",
  "moments": [
    {
      "momentType": "START" | "DEVELOPMENT" | "CLOSING",
      "allocatedMinutes": number,
      "pedagogicalProcesses": "string",
      "activitiesDescription": "string",
      "duaNotes": "string o null"
    }
  ],
  "evaluationCriteria": ["criterio 1", "criterio 2", "criterio 3", "criterio 4", "criterio 5"]
}`;

    const userPrompt = `Datos de la sesión:
Área: ${input.areaName}
Grado: ${input.gradeLevel}
Título de Unidad: ${input.unitTitle}
Título de Sesión: ${input.sessionTitle}
Enfoque Transversal: ${input.crossCuttingTheme}
Competencias y Desempeños:
${input.selectedCompetencies
  .map(
    (c) =>
      `- Competencia: ${c.title}\n  Desempeño base: ${c.standardDescription}`,
  )
  .join("\n")}`;

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Fallo en el proveedor LLM (${response.status}): ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) {
      throw new Error("Respuesta vacía o inválida del proveedor LLM.");
    }

    const parsed = JSON.parse(rawJson) as GeneratedSessionPayload;

    if (
      !Array.isArray(parsed.evaluationCriteria) ||
      parsed.evaluationCriteria.length !== 5
    ) {
      throw new ValidationError(
        "El motor LLM no devolvió los 5 criterios de evaluación requeridos.",
      );
    }

    return parsed;
  }
}
