-- Las fechas de los trimestres pasan a ser una por curso escolar, comunes a todos los alumnos. Cada
-- alumno conserva sus trimestres, porque abrirlos y cerrarlos sigue siendo cosa de cada uno; sus
-- fechas son una copia del calendario que la aplicación mantiene al día.
CREATE TABLE calendario_trimestre (
  curso TEXT NOT NULL CHECK (curso GLOB '[0-9][0-9][0-9][0-9]/[0-9][0-9][0-9][0-9]'),
  numero INTEGER NOT NULL CHECK (numero IN (1, 2, 3)),
  fecha_inicio TEXT NOT NULL CHECK (fecha_inicio GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  fecha_fin TEXT NOT NULL CHECK (fecha_fin GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  PRIMARY KEY (curso, numero),
  CHECK (fecha_fin >= fecha_inicio)
);

-- Para cada curso escolar, el calendario es el juego de fechas que más se repite entre sus alumnos;
-- a igualdad, el del curso abierto más recientemente.
WITH firmas AS (
  SELECT ca.id, ca.curso,
         group_concat(t.fecha_inicio || '>' || t.fecha_fin, ' ' ORDER BY t.numero) AS firma
  FROM curso_academico ca JOIN trimestre t ON t.curso_academico_id = ca.id
  GROUP BY ca.id
),
elegido AS (
  SELECT curso, id FROM (
    SELECT f.curso, f.id,
           row_number() OVER (
             PARTITION BY f.curso
             ORDER BY (SELECT count(*) FROM firmas g WHERE g.curso = f.curso AND g.firma = f.firma) DESC, f.id DESC
           ) AS orden
    FROM firmas f
  ) WHERE orden = 1
)
INSERT INTO calendario_trimestre (curso, numero, fecha_inicio, fecha_fin)
SELECT e.curso, t.numero, t.fecha_inicio, t.fecha_fin
FROM elegido e JOIN trimestre t ON t.curso_academico_id = e.id;

-- Los alumnos con otras fechas se ajustan al calendario, pero solo si nada se descoloca: ningún
-- trimestre cerrado cambia de fechas y ninguna sesión queda fuera de su trimestre. Los que no se
-- puedan ajustar conservan sus fechas, y la pantalla del calendario los señala.
UPDATE trimestre
SET fecha_inicio = (
      SELECT c.fecha_inicio FROM calendario_trimestre c JOIN curso_academico ca ON ca.curso = c.curso
      WHERE ca.id = trimestre.curso_academico_id AND c.numero = trimestre.numero),
    fecha_fin = (
      SELECT c.fecha_fin FROM calendario_trimestre c JOIN curso_academico ca ON ca.curso = c.curso
      WHERE ca.id = trimestre.curso_academico_id AND c.numero = trimestre.numero)
WHERE curso_academico_id IN (
  SELECT ca.id FROM curso_academico ca
  WHERE NOT EXISTS (
      SELECT 1 FROM trimestre t JOIN calendario_trimestre c ON c.curso = ca.curso AND c.numero = t.numero
      WHERE t.curso_academico_id = ca.id AND t.estado = 'cerrado'
        AND (t.fecha_inicio <> c.fecha_inicio OR t.fecha_fin <> c.fecha_fin))
    AND NOT EXISTS (
      SELECT 1 FROM sesion s
      JOIN trimestre t ON t.id = s.trimestre_id
      JOIN calendario_trimestre c ON c.curso = ca.curso AND c.numero = t.numero
      WHERE t.curso_academico_id = ca.id AND (s.fecha < c.fecha_inicio OR s.fecha > c.fecha_fin))
);
