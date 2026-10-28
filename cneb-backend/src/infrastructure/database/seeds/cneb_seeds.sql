-- 1. Áreas Oficiales
INSERT INTO areas (id, name, cycle, is_active) VALUES
('COM', 'Comunicación', 'VI-VII', TRUE),
('EPT', 'Educación para el Trabajo', 'VI-VII', TRUE),
('MAT', 'Matemática', 'VI-VII', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. Competencias
INSERT INTO competencies (id, area_id, title, description) VALUES
-- Comunicación (3)
('COM_C01', 'COM', 'Se comunica oralmente en su lengua materna', 'Interactúa de forma estratégica, adecúa ideas, obtiene información y evalúa el texto oral.'),
('COM_C02', 'COM', 'Lee diversos tipos de textos escritos en lengua materna', 'Identifica información explícita e implícita, deduce relaciones causales y reflexiona sobre el contenido.'),
('COM_C03', 'COM', 'Escribe diversos tipos de textos en su lengua materna', 'Adecúa el texto a la situación, organiza y desarrolla ideas con coherencia, cohesión y normas gramaticales.'),

-- EPT (1)
('EPT_C01', 'EPT', 'Gestiona proyectos de emprendimiento económico o social', 'Crea propuestas de valor, aplica habilidades técnicas, trabaja cooperativamente y evalúa resultados.'),

-- Matemática (4)
('MAT_C01', 'MAT', 'Resuelve problemas de cantidad', 'Comprende nociones numéricas, operaciones, estimaciones y estrategias de cálculo.'),
('MAT_C02', 'MAT', 'Resuelve problemas de regularidad, equivalencia y cambio', 'Traduce regularidades a patrones, ecuaciones, inecuaciones y funciones.'),
('MAT_C03', 'MAT', 'Resuelve problemas de forma, movimiento y localización', 'Modela formas geométricas, sus relaciones, transformaciones y ubicación en el espacio.'),
('MAT_C04', 'MAT', 'Resuelve problemas de gestión de datos e incertidumbre', 'Representa datos con gráficos, medidas estadísticas y probabilidades para tomar decisiones.')
ON CONFLICT (id) DO NOTHING;

-- 3. Capacidades Oficiales
INSERT INTO capacities (id, competency_id, title, order_index) VALUES
-- EPT (4 capacidades estándar)
('EPT_CAP_01', 'EPT_C01', 'Crea propuestas de valor', 1),
('EPT_CAP_02', 'EPT_C01', 'Aplica habilidades técnicas', 2),
('EPT_CAP_03', 'EPT_C01', 'Trabaja cooperativamente para lograr objetivos y metas', 3),
('EPT_CAP_04', 'EPT_C01', 'Evalúa los resultados del proyecto de emprendimiento', 4),

-- COM_C01 (Oral)
('COM_CAP_01', 'COM_C01', 'Obtiene información del texto oral', 1),
('COM_CAP_02', 'COM_C01', 'Infiere e interpreta información del texto oral', 2),
('COM_CAP_03', 'COM_C01', 'Adecúa, organiza y desarrolla las ideas de forma coherente y cohesionada', 3),
('COM_CAP_04', 'COM_C01', 'Utiliza recursos no verbales y paraverbales de forma estratégica', 4),
('COM_CAP_05', 'COM_C01', 'Interactúa estratégicamente con distintos interlocutores', 5),
('COM_CAP_06', 'COM_C01', 'Reflexiona y evalúa la forma, el contenido y contexto del texto oral', 6),

-- COM_C02 (Lectura)
('COM_CAP_07', 'COM_C02', 'Obtiene información del texto escrito', 1),
('COM_CAP_08', 'COM_C02', 'Infiere e interpreta información del texto', 2),
('COM_CAP_09', 'COM_C02', 'Reflexiona y evalúa la forma, el contenido y contexto del texto', 3),

-- COM_C03 (Escritura)
('COM_CAP_10', 'COM_C03', 'Adecúa el texto a la situación comunicativa', 1),
('COM_CAP_11', 'COM_C03', 'Organiza y desarrolla las ideas de forma coherente y cohesionada', 2),
('COM_CAP_12', 'COM_C03', 'Utiliza convenciones del lenguaje escrito de forma pertinente', 3),
('COM_CAP_13', 'COM_C03', 'Reflexiona y evalúa la forma, el contenido y contexto del texto escrito', 4)
ON CONFLICT (id) DO NOTHING;

-- 4. Desempeños Base CNEB (Oficiales 1.° y 3.° secundaria)
INSERT INTO performances (id, competency_id, grade_level, standard_description) VALUES
-- EPT
('PERF_EPT_01_1G', 'EPT_C01', 'FIRST', 'Emplea habilidades técnicas para producir un bien o brindar servicios siendo responsable con el ambiente y aplicando normas de seguridad en el trabajo.'),
('PERF_EPT_01_3G', 'EPT_C01', 'THIRD', 'Planifica las actividades de su equipo organizando recursos y aplicando habilidades técnicas para generar propuestas de valor sustentables.'),

-- Comunicación (1.° y 3.° Secundaria)
('PERF_COM_01_1G', 'COM_C01', 'FIRST', 'Adecúa el texto oral a la situación comunicativa considerando el propósito comunicativo, tipo textual y algunas características del género discursivo.'),
('PERF_COM_03_1G', 'COM_C03', 'FIRST', 'Adecúa el texto a la situación comunicativa considerando el propósito comunicativo, el tipo textual y algunas características del género discursivo, así como el formato y soporte.'),
('PERF_COM_01_3G', 'COM_C01', 'THIRD', 'Adecúa el texto oral considerando el propósito comunicativo, manteniendo el registro formal y empleando recursos no verbales y paraverbales en debates escolares.'),
('PERF_COM_02_3G', 'COM_C02', 'THIRD', 'Identifica información explícita, relevante y complementaria en textos argumentativos y expositivos. Deduce relaciones lógicas y la intención del autor contrastando posturas.'),

-- Matemática (3.° Secundaria)
('PERF_MAT_01_3G', 'MAT_C01', 'THIRD', 'Establece relaciones entre datos y acciones de comparar, igualar y reiterar cantidades.'),
('PERF_MAT_02_3G', 'MAT_C02', 'THIRD', 'Traduce datos a expresiones algebraicas y funciones lineales para resolver situaciones problemáticas.'),
('PERF_MAT_03_3G', 'MAT_C03', 'THIRD', 'Modela características geométricas y relaciones de semejanza y congruencia en polígonos y planos.'),
('PERF_MAT_04_3G', 'MAT_C04', 'THIRD', 'Representa el comportamiento de datos mediante gráficos estadísticos y medidas de tendencia central.')
ON CONFLICT (id) DO NOTHING;