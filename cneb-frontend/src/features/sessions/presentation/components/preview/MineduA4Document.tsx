import { SessionPreviewEntity } from "../../../domain/session.types";
import { Download, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { DocumentSkeleton } from "./DocumentSkeleton";
import {
  AREA_NAME_MAP,
  DURATION_LABEL_MAP,
  GRADE_LABEL_MAP,
  INSTRUMENT_LABEL_MAP,
  MOMENT_LABEL_MAP,
} from "@/features/curriculum/domain/cneb-labels";

interface PreviewProps {
  data: SessionPreviewEntity;
  teacherName?: string;
  schoolName?: string;
  ugelText?: string;
  isLoading?: boolean;
  isDownloading?: boolean;
  onDownload: () => void;
}

export function MineduA4Document({
  data,
  teacherName,
  schoolName,
  ugelText,
  isLoading = false,
  isDownloading,
  onDownload,
}: PreviewProps) {
  const areaName = AREA_NAME_MAP[data.areaId] || data.areaName || data.areaId;
  const gradeLabel = GRADE_LABEL_MAP[data.gradeLevel] || data.gradeLevel;
  const durationLabel =
    DURATION_LABEL_MAP[data.pedagogicalDuration] || data.pedagogicalDuration;
  const instrumentLabel =
    INSTRUMENT_LABEL_MAP[data.instrument.instrumentType] ||
    data.instrument.instrumentType;
  const sectionsText =
    data.sections.length > 0 ? data.sections.join(", ") : "—";

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Barra de Acciones Superior */}
      <div className="flex items-center justify-between rounded-lg border bg-white p-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-bold text-slate-800">
            Vista Previa Oficial MINEDU
          </span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            Formato A4
          </span>
        </div>
        <Button
          onClick={onDownload}
          disabled={isDownloading || isLoading}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow text-xs h-8"
        >
          <Download className="h-3.5 w-3.5" />
          {isDownloading ? "Generando..." : "Descargar Word (.docx)"}
        </Button>
      </div>

      {/* Visor con scroll vertical independiente */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-slate-300 bg-slate-200/70 p-3 sm:p-5 flex flex-col items-center gap-6">
        {isLoading ? (
          <DocumentSkeleton />
        ) : (
          <>
            {/* PÁGINA 1: PLANIFICACIÓN DE LA SESIÓN */}
            <div className="w-full max-w-[780px] h-auto bg-white p-7 sm:p-9 shadow-lg border border-slate-300 text-slate-900 font-sans text-xs space-y-3.5 leading-normal rounded-sm">
              {/* Cabecera Oficial */}
              <div className="text-center space-y-1 border-b border-slate-300 pb-3">
                <p className="text-[10px] font-bold tracking-wider text-slate-600 uppercase">
                  {ugelText ||
                    "Gobierno Regional de Lima • DRELM • UGEL 01 San Juan de Miraflores / Villa El Salvador"}
                </p>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                  {schoolName || 'I.E. N.° 6066 "VILLA EL SALVADOR"'}
                </h2>
                <p className="text-[11px] font-semibold text-slate-700">
                  PLANIFICACIÓN DE SESIÓN DE APRENDIZAJE •{" "}
                  {data.unitTitle || "Unidad Didáctica"}
                </p>
              </div>

              {/* Ficha de Datos Generales */}
              <div className="grid grid-cols-2 gap-2 border border-slate-300 p-2.5 rounded bg-slate-50/70 text-[11px]">
                <div>
                  <span className="font-bold text-slate-800">
                    Área Curricular:{" "}
                  </span>
                  <span className="text-slate-700">{areaName}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-800">
                    Grado y Sección:{" "}
                  </span>
                  <span className="text-slate-700">
                    {gradeLabel} • Secciones: {sectionsText}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-800">
                    Duración Pedagógica:{" "}
                  </span>
                  <span className="text-slate-700">{durationLabel}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-800">
                    Docente Titular:{" "}
                  </span>
                  <span className="text-slate-700">
                    {teacherName || "Jamir Jafet Ascencio Flores"}
                  </span>
                </div>
              </div>

              {/* Título de la Sesión */}
              <div className="border-l-4 border-emerald-600 bg-emerald-50/50 p-2 rounded-r">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Título de la Sesión
                </span>
                <p className="text-xs font-bold text-slate-900 mt-0.5">
                  “{data.sessionTitle || "Sin título"}”
                </p>
              </div>

              {/* I. Matriz de Aprendizajes */}
              <div className="space-y-1">
                <div className="bg-slate-800 text-white px-2 py-0.5 text-[10.5px] font-bold tracking-wider rounded-t">
                  I. PROPÓSITOS DE APRENDIZAJE (CNEB / RVM N° 094-2020-MINEDU)
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[10px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold text-left">
                    <tr>
                      <th className="border border-slate-300 p-1.5 w-1/4">
                        Competencias y Capacidades
                      </th>
                      <th className="border border-slate-300 p-1.5 w-2/5">
                        Desempeño Precisado
                      </th>
                      <th className="border border-slate-300 p-1.5 w-1/4">
                        Evidencia de Aprendizaje
                      </th>
                      <th className="border border-slate-300 p-1.5">
                        Instrumento
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.competencies.map((comp, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="border border-slate-300 p-1.5">
                          <p className="font-bold text-slate-900">
                            {comp.competencyTitle}
                          </p>
                          <ul className="list-disc list-inside text-slate-600 mt-0.5 space-y-0.5">
                            {comp.capacities.map((cap, cIdx) => (
                              <li key={cIdx}>{cap}</li>
                            ))}
                          </ul>
                        </td>
                        <td className="border border-slate-300 p-1.5 text-slate-800 leading-snug">
                          {comp.precisedPerformance}
                        </td>
                        <td className="border border-slate-300 p-1.5 text-slate-800 font-medium">
                          {data.evidenceDescription}
                        </td>
                        <td className="border border-slate-300 p-1.5 font-bold text-slate-900">
                          {instrumentLabel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* II. Secuencia Didáctica */}
              <div className="space-y-1.5">
                <div className="bg-slate-800 text-white px-2 py-0.5 text-[10.5px] font-bold tracking-wider rounded-t flex justify-between">
                  <span>II. MOMENTOS DE LA SESIÓN</span>
                  <span>{durationLabel}</span>
                </div>

                <div className="space-y-2">
                  {data.didacticMoments.map((moment, idx) => {
                    const momentLabel =
                      MOMENT_LABEL_MAP[moment.momentType] || moment.momentType;
                    return (
                      <div
                        key={idx}
                        className="border border-slate-300 p-2 rounded space-y-1 bg-white"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
                          <span className="font-extrabold text-slate-900 text-[11px]">
                            {momentLabel} ({moment.allocatedMinutes} minutos)
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium italic">
                            {moment.pedagogicalProcesses}
                          </span>
                        </div>
                        <p className="text-slate-800 leading-relaxed text-[10.5px]">
                          {moment.activitiesDescription}
                        </p>
                        {data.hasDuaInclusion && moment.duaNotes && (
                          <div className="rounded bg-emerald-50 border border-emerald-200 p-1.5 text-[10px] text-emerald-900">
                            <span className="font-bold">
                              Adaptación DUA Integrada:{" "}
                            </span>
                            {moment.duaNotes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recuadros Finales */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="border border-slate-300 p-2 rounded bg-slate-50">
                  <span className="font-bold text-[10px] text-slate-800 block uppercase border-b border-slate-200 pb-0.5">
                    MATERIALES O RECURSOS A UTILIZAR
                  </span>
                  <ul className="list-disc list-inside text-slate-700 text-[10px] mt-1 space-y-0.5">
                    {data.materialsAndResources.length > 0 ? (
                      data.materialsAndResources.map((mat, i) => (
                        <li key={i}>{mat}</li>
                      ))
                    ) : (
                      <li className="text-slate-400 italic">
                        No se especificaron materiales
                      </li>
                    )}
                  </ul>
                </div>

                <div className="border border-slate-300 p-2 rounded bg-slate-50">
                  <span className="font-bold text-[10px] text-slate-800 block uppercase border-b border-slate-200 pb-0.5">
                    EVALUACIÓN
                  </span>
                  <p className="text-slate-700 text-[10px] mt-1 leading-snug">
                    {data.evaluationDeclaration}
                  </p>
                </div>
              </div>

              {/* Firma Docente en Hoja 1 */}
              <div className="pt-6 pb-2 flex justify-end">
                <div className="w-52 text-center border-t border-slate-800 pt-1">
                  <p className="text-[10.5px] font-bold text-slate-900">
                    {teacherName || "Jamir Jafet Ascencio Flores"}
                  </p>
                  <p className="text-[9.5px] text-slate-500">
                    Docente de Área •{" "}
                    {schoolName
                      ? schoolName.split('"')[1] || schoolName
                      : "I.E. 6066"}
                  </p>
                </div>
              </div>
            </div>

            {/* PÁGINA 2 (ANEXO): INSTRUMENTO DE EVALUACIÓN */}
            {data.instrument.appendTableToDocument && (
              <div className="w-full max-w-[780px] h-auto bg-white p-7 sm:p-9 shadow-lg border border-slate-300 text-slate-900 font-sans text-xs space-y-4 leading-normal rounded-sm">
                <div className="border-b border-slate-300 pb-3 text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wide">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>ANEXO: INSTRUMENTO DE EVALUACIÓN FORMATIVA</span>
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {instrumentLabel.toUpperCase()}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Evidencia evaluada:{" "}
                    {data.evidenceDescription || data.sessionTitle}
                  </p>
                </div>

                <div className="space-y-2">
                  <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
                    <thead className="bg-slate-100 text-slate-700 font-bold">
                      <tr>
                        <th className="border border-slate-300 p-2 w-10 text-center">
                          N.°
                        </th>
                        <th className="border border-slate-300 p-2 text-left">
                          Criterios de Evaluación Observable
                        </th>
                        <th className="border border-slate-300 p-2 w-16 text-center">
                          SÍ
                        </th>
                        <th className="border border-slate-300 p-2 w-16 text-center">
                          NO
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.instrument.criteria.map((crit) => (
                        <tr
                          key={crit.criterionNumber}
                          className="hover:bg-slate-50/50"
                        >
                          <td className="border border-slate-300 p-2 text-center font-bold text-slate-800">
                            {crit.criterionNumber}
                          </td>
                          <td className="border border-slate-300 p-2 text-slate-800 leading-snug">
                            {crit.description}
                          </td>
                          <td className="border border-slate-300 p-2 text-center text-slate-400 font-normal">
                            ☐
                          </td>
                          <td className="border border-slate-300 p-2 text-center text-slate-400 font-normal">
                            ☐
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <p className="text-[10px] text-slate-500 italic pt-1">
                    * Tabla generada sin nombres de estudiantes ficticios para
                    aplicación directa en aula.
                  </p>
                </div>

                {/* Espacio para sello o firma en anexo */}
                <div className="pt-16 pb-2 flex justify-end">
                  <div className="w-52 text-center border-t border-slate-800 pt-1">
                    <p className="text-[10px] font-bold text-slate-900">
                      {teacherName || "Jamir Jafet Ascencio Flores"}
                    </p>
                    <p className="text-[9px] text-slate-500">
                      Firma del Docente Evaluador
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
