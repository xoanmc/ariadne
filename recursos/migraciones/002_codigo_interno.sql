-- T2.1: el código interno de un alumno no cambia nunca ni se reutiliza (P6).
-- A-07 tiene que seguir siendo siempre la misma persona.

-- Último número entregado. Vive aparte de la tabla de alumnos para que, aunque algún día se borre
-- un alumno, su número no vuelva a darse.
CREATE TABLE secuencia_codigo (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ultimo INTEGER NOT NULL CHECK (ultimo >= 0)
);

INSERT INTO secuencia_codigo (id, ultimo)
SELECT 1, COALESCE(MAX(CAST(substr(codigo_interno, 3) AS INTEGER)), 0)
FROM alumno
WHERE codigo_interno GLOB 'A-[0-9]*';

CREATE TRIGGER secuencia_codigo_no_retrocede
BEFORE UPDATE OF ultimo ON secuencia_codigo
WHEN NEW.ultimo < OLD.ultimo
BEGIN
  SELECT RAISE(ABORT, 'La secuencia de códigos internos no puede retroceder');
END;

CREATE TRIGGER alumno_codigo_inmutable
BEFORE UPDATE OF codigo_interno ON alumno
WHEN NEW.codigo_interno IS NOT OLD.codigo_interno
BEGIN
  SELECT RAISE(ABORT, 'El código interno de un alumno no cambia nunca');
END;
