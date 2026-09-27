-- T2.3: un alumno tiene como mucho un curso activo. Para abrir el siguiente hay que cerrar antes
-- el tercer trimestre del actual, que es lo que cierra el curso (RF-07).
CREATE UNIQUE INDEX curso_activo_por_alumno ON curso_academico (alumno_id) WHERE estado = 'activo';
