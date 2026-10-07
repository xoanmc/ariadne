-- Opciones iniciales del registro, decididas por el usuario el 2026-10-07 como punto de partida.
-- Ella las cambia, añade o desactiva desde "Opciones del registro". Se colocan al final de lo que
-- ya hubiera, y si alguna ya existe con el mismo texto no se duplica.
INSERT OR IGNORE INTO opcion_catalogo (categoria, texto, orden)
SELECT categoria, texto, (SELECT COALESCE(MAX(orden), 0) FROM opcion_catalogo o WHERE o.categoria = nuevas.categoria) + posicion
FROM (
  SELECT 'estado_alumno' AS categoria, 'Tranquilo' AS texto, 1 AS posicion
  UNION ALL SELECT 'estado_alumno', 'Cansado', 2
  UNION ALL SELECT 'estado_alumno', 'Inquieto', 3
  UNION ALL SELECT 'respuesta_actividades', 'Participa', 1
  UNION ALL SELECT 'respuesta_actividades', 'Necesita apoyo', 2
  UNION ALL SELECT 'respuesta_actividades', 'Se distrae', 3
) AS nuevas;
