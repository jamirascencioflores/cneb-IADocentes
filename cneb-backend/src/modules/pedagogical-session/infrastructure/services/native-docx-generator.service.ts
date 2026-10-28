import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
} from "docx";
import {
  DocxSessionData,
  IDocxGeneratorService,
} from "../../domain/docx-generator.interface.js";
import { InstitutionalProfile } from "../../../identity/domain/institutional-profile.entity.js";

export class NativeDocxGeneratorService implements IDocxGeneratorService {
  private createBoldParagraph(
    text: string,
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType],
  ): Paragraph {
    return new Paragraph({
      ...(alignment !== undefined ? { alignment } : {}),
      children: [new TextRun({ text, bold: true })],
    });
  }

  public async compile(
    sessionData: DocxSessionData,
    profile: InstitutionalProfile,
  ): Promise<Buffer> {
    const tableBorder = {
      style: BorderStyle.SINGLE,
      size: 4,
      color: "D1D5DB",
    };

    const cellBorders = {
      top: tableBorder,
      bottom: tableBorder,
      left: tableBorder,
      right: tableBorder,
    };

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1134,
                bottom: 1134,
                left: 1134,
                right: 1134,
              },
            },
          },
          children: [
            // Título de la Sesión
            new Paragraph({
              text: sessionData.sessionTitle.toUpperCase(),
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),

            // Bloque 1: Datos Informativos
            new Paragraph({
              text: "I. DATOS INFORMATIVOS",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 150, after: 100 },
            }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      borders: cellBorders,
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "Institución Educativa: ",
                              bold: true,
                            }),
                            new TextRun(profile.schoolName),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({
                      borders: cellBorders,
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: "UGEL / DRE: ", bold: true }),
                            new TextRun(`${profile.ugel} - ${profile.dre}`),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      borders: cellBorders,
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: "Docente: ", bold: true }),
                            new TextRun(profile.teacherFullName),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({
                      borders: cellBorders,
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: "Área / Grado: ", bold: true }),
                            new TextRun(
                              `${sessionData.areaName} - ${sessionData.gradeLevel}`,
                            ),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      borders: cellBorders,
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: "Duración: ", bold: true }),
                            new TextRun(sessionData.pedagogicalDuration),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({
                      borders: cellBorders,
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: "Secciones: ", bold: true }),
                            new TextRun(sessionData.sections),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),

            // Bloque 2: Propósito de Aprendizaje
            new Paragraph({
              text: "II. PROPÓSITOS DE APRENDIZAJE Y EVALUACIÓN",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      borders: cellBorders,
                      children: [
                        this.createBoldParagraph(
                          "Competencia / Desempeño Precisado",
                        ),
                      ],
                    }),
                    new TableCell({
                      borders: cellBorders,
                      children: [
                        this.createBoldParagraph("Evidencia e Instrumento"),
                      ],
                    }),
                  ],
                }),
                ...sessionData.competencies.map(
                  (c) =>
                    new TableRow({
                      children: [
                        new TableCell({
                          borders: cellBorders,
                          children: [
                            this.createBoldParagraph(c.title),
                            new Paragraph({ text: c.precisedPerformance }),
                          ],
                        }),
                        new TableCell({
                          borders: cellBorders,
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: "Evidencia: ",
                                  bold: true,
                                }),
                                new TextRun(sessionData.evidenceDescription),
                              ],
                            }),
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: "Evaluación: ",
                                  bold: true,
                                }),
                                new TextRun(sessionData.evaluationDeclaration),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                ),
              ],
            }),

            // Bloque 3: Secuencia Didáctica
            new Paragraph({
              text: "III. SECUENCIA DIDÁCTICA",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 20, type: WidthType.PERCENTAGE },
                      borders: cellBorders,
                      children: [this.createBoldParagraph("Momento / Tiempo")],
                    }),
                    new TableCell({
                      width: { size: 80, type: WidthType.PERCENTAGE },
                      borders: cellBorders,
                      children: [
                        this.createBoldParagraph(
                          "Procesos Pedagógicos y Actividades",
                        ),
                      ],
                    }),
                  ],
                }),
                ...sessionData.moments.map(
                  (m) =>
                    new TableRow({
                      children: [
                        new TableCell({
                          borders: cellBorders,
                          children: [
                            this.createBoldParagraph(m.momentType),
                            new Paragraph({
                              text: `(${m.allocatedMinutes} min)`,
                            }),
                          ],
                        }),
                        new TableCell({
                          borders: cellBorders,
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({ text: "Procesos: ", bold: true }),
                                new TextRun(m.pedagogicalProcesses),
                              ],
                            }),
                            new Paragraph({
                              text: m.activitiesDescription,
                              spacing: { before: 60 },
                            }),
                            ...(m.duaNotes
                              ? [
                                  new Paragraph({
                                    children: [
                                      new TextRun({
                                        text: "[DUA Aplicado]: ",
                                        bold: true,
                                      }),
                                      new TextRun(m.duaNotes),
                                    ],
                                    spacing: { before: 60 },
                                  }),
                                ]
                              : []),
                          ],
                        }),
                      ],
                    }),
                ),
              ],
            }),

            // Bloque 4: Recursos y Materiales
            new Paragraph({
              text: "IV. RECURSOS Y MATERIALES",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),
            ...sessionData.materialsAndResources.map(
              (res) =>
                new Paragraph({ text: `• ${res}`, spacing: { after: 40 } }),
            ),

            // Bloque 5: Anexo de Criterios de Evaluación
            ...(sessionData.evaluationCriteria &&
            sessionData.evaluationCriteria.length > 0
              ? [
                  new Paragraph({
                    text: "V. INSTRUMENTO DE EVALUACIÓN (LISTA DE COTEJO)",
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 },
                  }),
                  new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                      new TableRow({
                        children: [
                          new TableCell({
                            width: { size: 10, type: WidthType.PERCENTAGE },
                            borders: cellBorders,
                            children: [this.createBoldParagraph("N°")],
                          }),
                          new TableCell({
                            width: { size: 70, type: WidthType.PERCENTAGE },
                            borders: cellBorders,
                            children: [
                              this.createBoldParagraph(
                                "Criterios de Evaluación",
                              ),
                            ],
                          }),
                          new TableCell({
                            width: { size: 10, type: WidthType.PERCENTAGE },
                            borders: cellBorders,
                            children: [
                              this.createBoldParagraph(
                                "SÍ",
                                AlignmentType.CENTER,
                              ),
                            ],
                          }),
                          new TableCell({
                            width: { size: 10, type: WidthType.PERCENTAGE },
                            borders: cellBorders,
                            children: [
                              this.createBoldParagraph(
                                "NO",
                                AlignmentType.CENTER,
                              ),
                            ],
                          }),
                        ],
                      }),
                      ...sessionData.evaluationCriteria.map(
                        (crit, idx) =>
                          new TableRow({
                            children: [
                              new TableCell({
                                borders: cellBorders,
                                children: [
                                  new Paragraph({ text: String(idx + 1) }),
                                ],
                              }),
                              new TableCell({
                                borders: cellBorders,
                                children: [new Paragraph({ text: crit })],
                              }),
                              new TableCell({
                                borders: cellBorders,
                                children: [new Paragraph({ text: "" })],
                              }),
                              new TableCell({
                                borders: cellBorders,
                                children: [new Paragraph({ text: "" })],
                              }),
                            ],
                          }),
                      ),
                    ],
                  }),
                ]
              : []),

            // Espacio de Firma Docente
            new Paragraph({
              text: "________________________________________",
              alignment: AlignmentType.CENTER,
              spacing: { before: 600 },
            }),
            this.createBoldParagraph(
              profile.teacherFullName,
              AlignmentType.CENTER,
            ),
            new Paragraph({
              text: `Docente de ${profile.specialty}`,
              alignment: AlignmentType.CENTER,
            }),
          ],
        },
      ],
    });

    return Packer.toBuffer(doc);
  }
}
