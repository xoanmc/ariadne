-- Esquema inicial (T1.3). Convenciones:
--   fechas en TEXT 'AAAA-MM-DD', marcas de tiempo en ISO-8601
--   booleanos en INTEGER 0/1
--   estados y valoraciones en minúscula con guion bajo, con el vocabulario de la usuaria (P10)

CREATE TABLE alumno (
  id INTEGER PRIMARY KEY,
  codigo_interno TEXT NOT NULL UNIQUE CHECK (trim(codigo_interno) <> ''),
  nombre TEXT NOT NULL CHECK (trim(nombre) <> ''),
  apellidos TEXT NOT NULL CHECK (trim(apellidos) <> ''),
  fecha_nacimiento TEXT CHECK (fecha_nacimiento GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  diagnosticos TEXT,
  notas TEXT
);

CREATE TABLE curso_academico (
  id INTEGER PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumno (id),
  curso TEXT NOT NULL CHECK (curso GLOB '[0-9][0-9][0-9][0-9]/[0-9][0-9][0-9][0-9]'),
  nivel_educativo TEXT,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'cerrado')),
  -- Un curso enlaza con el del año anterior del mismo alumno; la cadena es lineal, nunca se bifurca
  curso_anterior_id INTEGER UNIQUE REFERENCES curso_academico (id),
  UNIQUE (alumno_id, curso),
  CHECK (curso_anterior_id IS NULL OR curso_anterior_id <> id)
);

CREATE TABLE trimestre (
  id INTEGER PRIMARY KEY,
  curso_academico_id INTEGER NOT NULL REFERENCES curso_academico (id),
  numero INTEGER NOT NULL CHECK (numero IN (1, 2, 3)),
  fecha_inicio TEXT NOT NULL CHECK (fecha_inicio GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  fecha_fin TEXT NOT NULL CHECK (fecha_fin GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  UNIQUE (curso_academico_id, numero),
  CHECK (fecha_fin >= fecha_inicio)
);

CREATE TABLE evaluacion_inicial (
  id INTEGER PRIMARY KEY,
  curso_academico_id INTEGER NOT NULL UNIQUE REFERENCES curso_academico (id),
  fecha TEXT NOT NULL CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  contenido TEXT NOT NULL,
  instrumento TEXT
);

CREATE TABLE programa_intervencion (
  id INTEGER PRIMARY KEY,
  curso_academico_id INTEGER NOT NULL UNIQUE REFERENCES curso_academico (id),
  fecha_creacion TEXT NOT NULL CHECK (fecha_creacion GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  fecha_revision TEXT CHECK (fecha_revision GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  contenido TEXT
);

-- Un objetivo pertenece a un programa y, por tanto, a un curso concreto: nunca cruza de curso.
-- La continuidad entre cursos vive en la cadena de asignacion_trimestral.
CREATE TABLE objetivo (
  id INTEGER PRIMARY KEY,
  programa_id INTEGER NOT NULL REFERENCES programa_intervencion (id),
  enunciado TEXT NOT NULL CHECK (trim(enunciado) <> ''),
  fecha_creacion TEXT NOT NULL CHECK (fecha_creacion GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);

CREATE TABLE asignacion_trimestral (
  id INTEGER PRIMARY KEY,
  objetivo_id INTEGER NOT NULL REFERENCES objetivo (id),
  trimestre_id INTEGER NOT NULL REFERENCES trimestre (id),
  valoracion TEXT NOT NULL DEFAULT 'sin_valorar'
    CHECK (valoracion IN ('sin_valorar', 'conseguido', 'no_conseguido', 'pendiente_desarrollar')),
  comentario TEXT,
  -- Cadena de arrastre: cada asignación procede como mucho de una anterior y da pie como mucho a una siguiente
  asignacion_anterior_id INTEGER UNIQUE REFERENCES asignacion_trimestral (id),
  UNIQUE (objetivo_id, trimestre_id),
  CHECK (asignacion_anterior_id IS NULL OR asignacion_anterior_id <> id)
);

-- alumno_id es redundante con el del trimestre y está a propósito (plan §4): evita un JOIN en casi
-- toda consulta diaria. La coherencia la garantiza la capa de servicios, no quien llame.
CREATE TABLE sesion (
  id INTEGER PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumno (id),
  trimestre_id INTEGER NOT NULL REFERENCES trimestre (id),
  fecha TEXT NOT NULL CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  estado_alumno TEXT,
  respuesta_actividades TEXT,
  incidencias TEXT,
  salud_medicacion TEXT
);

CREATE TABLE sesion_objetivo (
  sesion_id INTEGER NOT NULL REFERENCES sesion (id) ON DELETE CASCADE,
  objetivo_id INTEGER NOT NULL REFERENCES objetivo (id),
  PRIMARY KEY (sesion_id, objetivo_id)
);

CREATE TABLE acta_reunion (
  id INTEGER PRIMARY KEY,
  curso_academico_id INTEGER NOT NULL REFERENCES curso_academico (id),
  fecha TEXT NOT NULL CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  asistentes TEXT,
  contenido TEXT,
  acuerdos TEXT
);

-- Solo se usa en el informe para servicios externos; no clasifica objetivos ni sesiones.
CREATE TABLE area (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE CHECK (trim(nombre) <> ''),
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1))
);

CREATE TABLE documento_generado (
  id INTEGER PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'diario', 'evaluacion_inicial', 'programa', 'informe_trimestral', 'acta_reunion', 'informe_externo'
  )),
  alumno_id INTEGER NOT NULL REFERENCES alumno (id),
  curso_academico_id INTEGER NOT NULL REFERENCES curso_academico (id),
  trimestre_id INTEGER REFERENCES trimestre (id),
  fecha TEXT NOT NULL,
  contenido TEXT,
  ruta_fichero TEXT
);

CREATE TABLE plantilla (
  id INTEGER PRIMARY KEY,
  tipo_documento TEXT NOT NULL CHECK (tipo_documento IN (
    'diario', 'evaluacion_inicial', 'programa', 'informe_trimestral', 'acta_reunion', 'informe_externo'
  )),
  ruta_fichero TEXT NOT NULL CHECK (trim(ruta_fichero) <> ''),
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1))
);

CREATE UNIQUE INDEX plantilla_activa_por_tipo ON plantilla (tipo_documento) WHERE activa = 1;

-- Vocabulario del registro rápido, editable desde la aplicación (RF-13, P10).
CREATE TABLE opcion_catalogo (
  id INTEGER PRIMARY KEY,
  categoria TEXT NOT NULL CHECK (categoria IN ('estado_alumno', 'respuesta_actividades')),
  texto TEXT NOT NULL CHECK (trim(texto) <> ''),
  orden INTEGER NOT NULL DEFAULT 0,
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  UNIQUE (categoria, texto)
);
