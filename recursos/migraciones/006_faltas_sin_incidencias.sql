-- T4.6, a petición suya: el registro deja de tener incidencias y puede anotar que el alumno no acudió.

-- Lo que hubiera escrito en incidencias no se pierde: pasa al final de sus observaciones.
UPDATE sesion
SET observaciones = CASE
    WHEN observaciones IS NULL THEN 'Incidencias: ' || incidencias
    ELSE observaciones || char(10) || char(10) || 'Incidencias: ' || incidencias
  END
WHERE incidencias IS NOT NULL;

ALTER TABLE sesion DROP COLUMN incidencias;

-- Una falta no lleva estado, respuesta ni salud: no hubo sesión que describir. Solo, si acaso, el motivo en observaciones.
ALTER TABLE sesion ADD COLUMN falta INTEGER NOT NULL DEFAULT 0
  CHECK (falta = 0 OR (falta = 1 AND estado_alumno IS NULL AND respuesta_actividades IS NULL AND salud_medicacion IS NULL));

-- Ni objetivos trabajados.
CREATE TRIGGER falta_sin_objetivos
BEFORE INSERT ON sesion_objetivo
WHEN (SELECT falta FROM sesion WHERE id = NEW.sesion_id) = 1
BEGIN
  SELECT RAISE(ABORT, 'Una falta no tiene objetivos trabajados');
END;

CREATE TRIGGER falta_sin_objetivos_al_corregir
BEFORE UPDATE OF falta ON sesion
WHEN NEW.falta = 1 AND EXISTS (SELECT 1 FROM sesion_objetivo WHERE sesion_id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'Una falta no tiene objetivos trabajados');
END;
