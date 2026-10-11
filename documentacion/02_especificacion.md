# Especificación funcional

Documento de qué y por qué. No contiene decisiones tecnológicas: eso corresponde al plan.

---

## 1. Problema

Una orientadora de educación especial atiende a sus alumnos en sesiones individuales. Lo observado en cada sesión es la base del seguimiento y conviene anotarlo mientras está reciente, en muy poco tiempo entre una sesión y otra.

El problema no es la evaluación ni el cálculo de resultados. Es la **captura**.

## 2. Usuaria

Una sola persona, con un equipo Windows. Registra después de la sesión, nunca durante, para no consumir el tiempo del alumno. Redacta ella misma.

## 3. Alcance

### Dentro

- Ficha de alumno y ciclo por curso académico
- Registro rápido de sesión
- Programa de intervención con objetivos trimestrales y arrastre
- Valoración de objetivos según rúbrica de tres estados
- Cierre de trimestre con verificación automática
- Registro de actas de reunión con familias
- Exportación de los registros de cada alumno por trimestre a un fichero de texto
- Exportación y copia de seguridad completas

### Fuera

Corrección automática de tests, baremos y puntuaciones. Comparación con población normativa. Gráficas de evolución. Multiusuario, roles y auditoría. Acceso de familias. Adjuntos multimedia. Registro durante la sesión. Sincronización entre dispositivos. Redacción automática de prosa clínica. Generación de informes y documentos sobre plantillas de Word (retirados el 2026-10-11 a petición suya: la aplicación se centra en el registro de las sesiones).

Cada exclusión es una decisión de producto.

---

## 4. Modelo de dominio

### Alumno

Identidad del alumno dentro del sistema. Persiste entre cursos.

- Nombre y apellidos
- **Código interno** — identificador estable y no identificativo (por ejemplo `A-07`), usado en toda salida hacia el exterior
- Fecha de nacimiento
- Diagnósticos (texto libre; TEA, TDAH, altas capacidades, dislexia, discalculia, disgrafía y combinaciones)
- Notas persistentes que no dependen del curso

### Curso académico

Contenedor anual. Un alumno tiene un registro por cada curso en que recibe intervención.

- Curso (por ejemplo `2025/2026`)
- Nivel educativo en ese curso
- Estado: activo o cerrado
- Referencia al curso anterior del mismo alumno, si existe

**Cierre:** el curso pasa a cerrado **automáticamente al cerrarse su tercer trimestre**. No es una acción independiente. Así no puede existir un curso abierto con los tres trimestres cerrados, ni quedar cursos antiguos figurando como activos por un paso olvidado.

### Trimestre

Subdivisión del curso. Tres por curso.

- Número (1, 2, 3)
- Fechas de inicio y fin
- Estado: abierto o cerrado

**Fechas:** al abrir el curso, la aplicación propone fechas orientativas para los tres trimestres (septiembre–diciembre, enero–marzo, abril–junio) y ella las ajusta al calendario real de su centro. La propuesta evita que el alta se detenga a pedir datos que aún no importan; la edición garantiza que acaben siendo las correctas. Las fechas sirven para situar automáticamente una sesión en su trimestre a partir de la fecha de la sesión.

Los trimestres no pueden solaparse, porque entonces una fecha caería en dos a la vez. Los huecos entre ellos sí son normales: son las vacaciones. Qué ocurre con una sesión fechada en vacaciones o fuera del curso se decide al diseñar el registro rápido (RF-12).

**Cierre:** ver RF-18. Un trimestre no puede cerrarse mientras quede algún objetivo `sin valorar`.

### Evaluación inicial

Se realiza a principio de curso **a todos los alumnos que acuden a sesiones individuales**, no solo a los nuevos. Es una de las dos entradas del programa de intervención, junto con el programa del curso anterior.

- Curso al que pertenece
- Fecha
- Contenido
- Instrumento utilizado, si lo hubo (Diverlexia, Prolexia u otros)

### Programa de intervención

Uno por alumno y curso. Se ajusta durante el año cuando cambian las necesidades.

- Curso
- Fecha de creación y de última revisión
- Contenido general
- Conjunto de objetivos

### Objetivo

Enunciado de trabajo. Pertenece a un programa y, por tanto, **a un curso concreto**.

- Enunciado
- Programa al que pertenece
- Fecha de creación

**Identidad entre cursos:** un objetivo no cruza de curso. Al arrastrar un objetivo pendiente del curso anterior se crea un **objetivo nuevo** en el programa del curso nuevo, con el enunciado copiado, y la continuidad se conserva a través del enlace entre asignaciones (ver más abajo).

Se decide así para que ella pueda reformular el enunciado en el curso nuevo sin reescribir el pasado: los informes ya emitidos siguen diciendo lo que decían el día en que se generaron. El recorrido histórico completo de un objetivo se obtiene siempre recorriendo la cadena de asignaciones, nunca la tabla de objetivos.

### Asignación trimestral

**Pieza central del modelo.** Un objetivo puesto en un trimestre concreto, con su valoración. Es la única entidad que atraviesa trimestres y cursos.

- Objetivo
- Trimestre
- Valoración: `sin valorar` · `conseguido` · `no conseguido` · `pendiente de desarrollar`
- Comentario opcional
- Referencia a la asignación anterior, cuando procede de un arrastre

El estado `sin valorar` es el inicial y **solo existe mientras el trimestre está abierto**: el cierre no se permite hasta que no queda ninguno.

**Semántica de la rúbrica:**

| Estado | ¿Se trabajó? | Resultado |
|---|---|---|
| Conseguido | Sí | Alcanzado |
| No conseguido | Sí | No alcanzado |
| Pendiente de desarrollar | No | No se abordó |

**Arrastre:** al cerrar un trimestre, los objetivos valorados como `no conseguido` o `pendiente de desarrollar` pueden trasladarse al trimestre siguiente. El traslado crea una asignación nueva enlazada a la anterior, conservando la cadena completa.

**Entre cursos** la mecánica es la misma con un paso más: se crea el objetivo nuevo en el programa del curso nuevo y su primera asignación queda enlazada a la última asignación del curso anterior. La cadena no se rompe en el salto de curso.

### Sesión

Registro de una sesión individual.

- Alumno y trimestre
- Fecha
- **Estado del alumno en sesión**
- **Respuesta a las actividades**
- Observaciones
- Estado de salud o medicación, si procede
- Si el alumno no acudió (falta)
- Objetivos trabajados en la sesión (opcional)

Desde el 2026-10-11, a petición suya, la sesión ya no lleva el apartado de incidencias, y puede registrarse que el alumno no acudió (RF-30).

El trimestre se deduce de la fecha de la sesión y del alumno; ella no lo elige. El alumno de la sesión y el del trimestre son por definición el mismo, y el sistema lo garantiza en lugar de confiarlo a quien rellene el formulario.

> **[NECESITA ACLARACIÓN]** Los dos campos centrales necesitan vocabulario concreto para poder ofrecerse como opciones seleccionables en lugar de texto libre. Se ajustará con el uso.

### Acta de reunión

Documento de las reuniones con familias. Cadencia ocasional.

- Alumno y curso
- Fecha
- Asistentes
- Contenido y acuerdos

Se registra en la aplicación. Desde el cambio de alcance no se genera como documento.

## 5. Exportación del trimestre

Sustituye a los documentos sobre plantillas, retirados el 2026-10-11. Al acabar cada trimestre, ella saca **un fichero de texto por alumno** con todo lo que registró: los datos del curso y del trimestre, los objetivos con su valoración y todas las sesiones en orden cronológico. Es su archivo personal: se abre con doble clic en cualquier Windows y se lee sin la aplicación.

---

## 6. Requisitos funcionales

### Gestión de alumnos

- **RF-01** Alta de alumno con asignación automática de código interno.
- **RF-02** Listado de alumnos activos con acceso a su ficha.
- **RF-03** Consulta del historial completo de un alumno a través de todos sus cursos.

### Ciclo académico

- **RF-04** Apertura de curso para un alumno, con enlace al curso anterior si existe.
- **RF-05** Registro de la evaluación inicial del curso.
- **RF-06** Los tres trimestres se crean automáticamente al abrir el curso, con fechas propuestas y editables.
- **RF-07** El curso pasa a cerrado automáticamente al cerrarse su tercer trimestre.

### Programa de intervención

- **RF-08** Creación del programa a partir del programa del curso anterior y de la evaluación inicial.
- **RF-09** Definición de objetivos y asignación al trimestre correspondiente.
- **RF-10** Modificación de objetivos durante el curso.
- **RF-11** Visualización de los objetivos del trimestre en curso con su valoración actual.

### Registro de sesión

- **RF-12** Registro de sesión en menos de dos minutos, con fecha propuesta automáticamente.
- **RF-13** Captura del estado del alumno y de su respuesta a las actividades mediante opciones seleccionables, con campo libre complementario.
- **RF-14** Asociación opcional de la sesión a los objetivos trabajados.
- **RF-15** Consulta de las sesiones de un alumno dentro de un trimestre.
- **RF-30** Registro de que el alumno no acudió a la sesión.

### Cierre de trimestre

- **RF-16** Valoración de cada objetivo del trimestre según la rúbrica.
- **RF-17** **Verificación automática** que indica, consultando los datos: objetivos sin valorar, objetivos marcados como no trabajados, número de sesiones registradas y objetivos sin ninguna sesión asociada.
- **RF-18** **Cierre bloqueante:** el trimestre no puede cerrarse mientras quede algún objetivo `sin valorar`. La verificación de RF-17 funciona como lista de pendientes, no como aviso descartable.
- **RF-19** Traslado de objetivos no cerrados al trimestre siguiente, conservando el enlace con la asignación previa.
- **RF-20** Aviso cuando un objetivo acumula **dos** trimestres consecutivos como `pendiente de desarrollar`.

### Reuniones

- **RF-21** Registro de acta de reunión asociada a un alumno y curso, con fecha, asistentes, contenido y acuerdos.

### Exportación del trimestre

- **RF-29** Exportación, para cada alumno y trimestre, de un fichero de texto con todas sus sesiones y registros, legible sin la aplicación.
- RF-22 a RF-25 (redacción de documentos, generación sobre plantilla, histórico de documentos y sustitución del nombre en lo que sale del equipo): **retirados** el 2026-10-11.

### Datos

- **RF-26** Exportación completa de todos los datos a un fichero.
- **RF-27** Copia de seguridad y restauración.
- **RF-28** Funcionamiento íntegro sin conexión a internet.

---

## 7. Requisitos no funcionales

- **RNF-01** Aplicación de escritorio en Windows, distribuida como carpeta portable (sin instalador).
- **RNF-02** Almacenamiento local en fichero bajo control de la usuaria.
- **RNF-03** Sin servidor, sin cuentas, sin conexión obligatoria.
- **RNF-04** Ningún dato identificativo abandona el equipo.
- **RNF-05** Apertura y uso sin latencia perceptible en la escala descrita.
- **RNF-06** Utilizable sin formación previa ni manual.

---

## 8. Criterios de aceptación

1. Registrar una sesión completa lleva menos de dos minutos cronometrados.
2. Al cerrar un trimestre, el sistema indica por sí solo qué objetivos quedaron sin valorar y cuáles no se trabajaron.
3. Un trimestre con algún objetivo sin valorar no puede cerrarse, y cerrar el tercero cierra el curso.
4. Un objetivo arrastrado durante tres trimestres puede consultarse con su cadena completa, incluso si el arrastre cruza de curso.
5. La exportación del trimestre de un alumno recoge todas sus sesiones y se lee sin la aplicación.
6. La aplicación funciona con el equipo desconectado de la red.
7. La usuaria puede llevarse todos sus datos en un único fichero.

---

## 9. Pendiente de resolver

| Asunto | Bloquea | Cómo se resuelve |
|---|---|---|
| Vocabulario de estado y respuesta en sesión | RF-13 | Ajustarlo con el uso |

Ninguno bloquea el plan técnico ni el modelo de dominio.

---

## 10. Decisiones cerradas

Registro de las decisiones que en su día quedaron abiertas, para no reabrirlas sin motivo.

| Asunto | Decisión |
|---|---|
| Trimestre con objetivos sin valorar | El cierre se bloquea hasta valorarlos todos (RF-18) |
| Umbral del aviso de estancamiento | Dos trimestres consecutivos, no tres (RF-20) |
| Actas de reunión | Dentro del alcance, solo como registro (RF-21) |
| Identidad del objetivo entre cursos | Objetivo nuevo por curso, enlazado por la cadena de asignaciones |
| Informes y plantillas de Word | Fuera del alcance desde el 2026-10-11, a petición suya. Los sustituye la exportación del trimestre (RF-29) |
| Pseudonimización | Sin salidas hacia el exterior desde el 2026-10-11; la exportación del trimestre es su archivo y lleva el nombre (P6) |
| Fechas de los trimestres | Propuestas al abrir curso, editables por ella (RF-06) |
| Cierre del curso académico | Automático al cerrar el tercer trimestre (RF-07) |
