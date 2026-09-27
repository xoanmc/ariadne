# Plan técnico

Cómo se construye lo especificado. Cada decisión indica el principio que la respalda y las alternativas descartadas.

---

## 1. Stack propuesto

| Capa | Elección |
|---|---|
| Empaquetado | Electron → carpeta portable Windows (zip) |
| Lenguaje | TypeScript |
| Interfaz | React |
| Datos | SQLite en fichero único |
| Acceso a datos | better-sqlite3 |
| Documentos | Relleno de plantillas `.docx` con marcadores |
| Pruebas | Vitest, sobre dominio y servicios críticos |

### Por qué Electron

**La interfaz se va a rediseñar varias veces.** El registro rápido tiene un criterio de aceptación cronometrado: menos de dos minutos. Eso no se acierta a la primera, se ajusta probando con ella. Con HTML y CSS se itera en minutos; con cualquier toolkit nativo, en horas.

**Todo dentro, sin instalación.** No hay que instalar runtimes en el equipo. Se descomprime una carpeta y funciona.

**La interfaz es reutilizable.** Si algún día hiciera falta, se reutiliza tal cual en un navegador. Con una aplicación nativa habría que reescribirla entera.

**Contra:** el paquete ronda los 150 MB y consume más memoria que una aplicación nativa. A esta escala, irrelevante (P9).

### Instalador NSIS descartado tras T0.1

El plan original preveía un instalador NSIS. Se abandonó después de probarlo en dos equipos Windows reales: el instalador funcionaba, pero la desinstalación se enquistaba (había que limpiar a mano con `regedit`). La causa es un bug conocido y sin arreglo de electron-builder (issue #4875): al compilar NSIS desde macOS, el desinstalador se genera ejecutando un binario Windows en tiempo de build, y ese paso falla en cross-build. Como NSIS reutiliza en silencio el desinstalador antiguo al actualizar sobre una instalación previa, el fallo habría roto también las actualizaciones futuras — bloqueante antes de construir nada encima.

Se sustituyó por distribución en zip (target `dir` de electron-builder + script de empaquetado que anida todo bajo una única carpeta `Ariadne/`): sin instalador, sin registro de Windows, sin desinstalador que pueda fallar. Descomprimir, ejecutar, y "desinstalar" es borrar la carpeta. Actualizar una versión es reemplazar la carpeta entera.

### Alternativas descartadas

**Java con JavaFX** — Apache POI es excelente para `.docx`. Se descarta porque la interfaz es mucho más lenta de iterar, y ese es justo el punto crítico del proyecto.

**Tauri** — paquete de 5 MB en lugar de 150. Se descarta porque mete Rust en el backend por un ahorro que aquí no aporta nada.

**Aplicación web con almacenamiento en navegador** — se descarta por frágil: limpiar el navegador borraría los datos.

---

## 2. Arquitectura

Cuatro capas, con dependencias siempre hacia dentro:

```
Interfaz          pantallas, sin lógica de negocio
    ↓
Servicios         casos de uso: cerrar trimestre, arrastrar objetivo
    ↓
Dominio           entidades y reglas, sin dependencias externas
    ↓
Persistencia      SQLite
```

**Documentos** cuelga de servicios como módulo aislado (P7). El dominio no sabe que existen las plantillas.

En Electron esto se reparte así: el proceso principal contiene dominio, servicios y persistencia; el proceso de interfaz solo pinta. Se comunican por mensajes, y la interfaz nunca toca la base de datos directamente.

Ventaja secundaria: las tres capas internas no dependen de Electron. Si mañana el destino fuera un navegador, se reutilizan sin tocar.

**Navegación** (decidida en T2.1): **todo parte del alumno.** La pantalla de inicio es la lista de sus alumnos, y desde cada uno se llega a todo lo suyo. Arriba, una barra mínima con "Alumnos" y, en una esquina y en discreto, "Copias de seguridad" (ubicación de los datos, copias y, más adelante, exportación). Se descartó un menú lateral por secciones: ella piensa en alumnos, no en secciones, y cada tarea empezaría por elegir sección y luego alumno. Con el registro rápido (T4.2), cada alumno de la lista tendrá su propio botón para registrar sesión, de modo que al salir de una sesión esté a un clic (P3).

**Cada curso tiene su propia pantalla** (T2.5): la ficha del alumno muestra sus datos y el historial de cursos, y cada curso se abre en una pantalla con todo lo suyo (trimestres, evaluación inicial y, desde el Hito 3, programa, objetivos, sesiones y actas). Todo lo que viene después cuelga del curso, así que la ficha no crece con cada hito. Un curso cerrado se consulta en la misma pantalla, sin poder modificarse.

En la lista, arriba van los alumnos con curso activo y, en una sección plegada, los que no lo tienen (recién dados de alta o que ya terminaron), para que ninguno quede inaccesible. La búsqueda recorre todos y se abre con Intro sin tocar el ratón (T2.2).

Si la copia de seguridad del día falla, el aviso se muestra en una banda sobre cualquier pantalla: la de copias ya no es la de inicio y el aviso no puede quedar escondido en ella.

---

## 3. Almacenamiento

Un único fichero SQLite. Eso cumple P1 y P2 de forma literal: copiar el fichero es la copia de seguridad, llevárselo es la portabilidad, y no existe servidor al que pedir permiso.

**Ubicación:** carpeta de datos del usuario, con la ruta visible y modificable desde la aplicación. Debe poder ponerlo en un USB si quiere. La ruta elegida se guarda en un pequeño `configuracion.json` en la carpeta de datos del usuario, fuera de la base (no puede vivir dentro del fichero que sirve para localizar).

- **Cambiar ubicación** copia la base a la carpeta elegida y pasa a usar la copia; el original se conserva sin cambios. Si en esa carpeta ya hay una base de Ariadne, nunca se sobrescribe: se ofrece abrir esa en su lugar (caso del USB llevado a otro equipo).
- **Si la base configurada no aparece al arrancar** (USB desconectado), la aplicación se bloquea con un aviso que muestra la ruta, con *Reintentar* y *Buscar la base en otra ubicación*. Solo el primer arranque crea una base nueva; después, **nunca se crea una vacía en silencio**, para que no crea haber perdido sus datos ni escriba en una base equivocada.
- **Un único fichero de verdad:** sin modo WAL, que generaría ficheros auxiliares junto a la base y rompería "copiar el fichero es la copia de seguridad".

**Copias de seguridad:** automática al arrancar, rotando las últimas diez. Manual bajo demanda. Ambas son copias del fichero.

Detalles fijados en T1.4:

- Las automáticas viven en una carpeta `copias/` **junto a la base**, así que acompañan a los datos si ella los mueve a un USB. La primera creación de la base no genera copia: estaría vacía.
- La **copia manual** se guarda donde ella elija con el diálogo del sistema, fuera de la rotación: es suya y no la borra nadie.
- **Restaurar guarda antes el estado actual como una copia más.** Restaurar por error no puede costarle datos, y la vuelta atrás está en la propia lista.
- Una copia que falla (USB protegido, disco lleno) **avisa pero no impide abrir la aplicación**. Perder la copia de hoy no puede dejarla sin trabajar.
- La rotación de diez cuenta aperturas, no días: si abre la aplicación varias veces al día, el histórico automático cubre menos de una semana. Suficiente como red de seguridad ante un error reciente, no como archivo histórico; para eso está la copia manual y la exportación (RF-26).
- **Las copias automáticas protegen de sus errores, no del equipo.** Viven en el mismo disco que los datos: si el portátil se estropea, lo roban o lo cifra un virus, se pierden juntos. Como trabajará casi siempre desde el mismo equipo, la recomendación que hay que darle es una copia manual a un USB o a la nube de vez en cuando; una por trimestre, al cerrarlo, es suficiente.
- Restaurar no mueve la copia restaurada en la lista: sigue con su fecha original y envejece como las demás. Los datos en uso no aparecen nunca en la lista; su estado pasa a ella con la copia del siguiente arranque.

**Exportación:** además del fichero SQLite, exportación a JSON legible. El SQLite garantiza que puede restaurar; el JSON garantiza que puede leer sus datos dentro de diez años sin esta aplicación. P1 pide lo segundo tanto como lo primero.

**Versionado de esquema:** tabla de control de versión y migraciones incrementales. Sin esto, cualquier cambio futuro arriesga sus datos. Las migraciones son ficheros `recursos/migraciones/NNN_descripcion.sql`, numerados sin huecos; cada una se aplica en su propia transacción, de modo que una que falle no deja rastro. Una base creada por una versión más reciente de la aplicación se rechaza en lugar de abrirse (puede pasar al llevar el USB a un equipo con una versión anterior).

---

## 4. Esquema de datos

```
alumno
  id · codigo_interno · nombre · apellidos
  fecha_nacimiento · diagnosticos · notas

curso_academico
  id · alumno_id · curso · nivel_educativo
  estado · curso_anterior_id

trimestre
  id · curso_academico_id · numero
  fecha_inicio · fecha_fin · estado

evaluacion_inicial
  id · curso_academico_id · fecha
  contenido · instrumento

programa_intervencion
  id · curso_academico_id
  fecha_creacion · fecha_revision · contenido

objetivo
  id · programa_id · enunciado · fecha_creacion

asignacion_trimestral
  id · objetivo_id · trimestre_id
  valoracion · comentario · asignacion_anterior_id

sesion
  id · alumno_id · trimestre_id · fecha
  estado_alumno · respuesta_actividades
  incidencias · salud_medicacion

sesion_objetivo
  sesion_id · objetivo_id

acta_reunion
  id · curso_academico_id · fecha
  asistentes · contenido · acuerdos

area
  id · nombre · activa

documento_generado
  id · tipo · alumno_id · curso_academico_id
  trimestre_id · fecha · contenido · ruta_fichero

plantilla
  id · tipo_documento · ruta_fichero · activa

opcion_catalogo
  id · categoria · texto · orden · activa
```

### Notas sobre el esquema

**`asignacion_trimestral` es la tabla central.** Contiene toda la mecánica de arrastre. La columna `asignacion_anterior_id` apunta a la asignación del trimestre previo y forma la cadena histórica: recorriéndola hacia atrás se obtiene el recorrido completo de un objetivo, y contando **dos** eslabones consecutivos con valoración `pendiente_desarrollar` se resuelve el aviso de RF-20.

Es también la única cadena que cruza de curso. `objetivo` cuelga de `programa_id`, o sea de un curso concreto: al arrastrar entre cursos se inserta un objetivo nuevo en el programa nuevo y su primera asignación apunta a la última del curso anterior. **Ninguna consulta de historial debe recorrer `objetivo`; todas recorren asignaciones.**

**`curso_anterior_id`** hace lo mismo un nivel arriba, y permite arrancar un curso partiendo del anterior.

**Claves ajenas redundantes.** `sesion` guarda `alumno_id` además de `trimestre_id`, y `documento_generado` guarda las tres. Es deliberado: evita un JOIN en prácticamente toda consulta del día a día. A cambio, la integridad se garantiza en la capa de servicios, no se confía al llamante:

- El servicio **deriva** el alumno a partir del trimestre al guardar. Nunca lo acepta como parámetro suelto.
- El trimestre, a su vez, se deriva del alumno y de la fecha de la sesión.
- Una prueba verifica que no exista ninguna sesión cuyo `alumno_id` difiera del alumno de su trimestre.

**`trimestre.fecha_inicio` / `fecha_fin`** se rellenan con una propuesta al abrir el curso y son editables después (RF-06). Se usan para situar una sesión en su trimestre por fecha, así que deben cubrir el curso sin solaparse; la validación vive en servicios.

**`curso_academico.estado`** no lo cambia ninguna acción propia: pasa a `cerrado` como efecto del cierre del tercer trimestre (RF-07), dentro de la misma transacción.

**`opcion_catalogo`** guarda el vocabulario del registro rápido, con `categoria` distinguiendo entre estado del alumno y respuesta a las actividades. Se deja editable desde la aplicación: las opciones iniciales serán una aproximación y necesitarán ajustarse con el uso.

**`valoracion`** admite exactamente cuatro valores: `sin_valorar`, `conseguido`, `no_conseguido`, `pendiente_desarrollar`. Restringido a nivel de base de datos (P10).

**Convenciones del esquema** (T1.3, `recursos/migraciones/001_esquema_inicial.sql`):

- Fechas en `TEXT` con formato `AAAA-MM-DD`, validado en la propia tabla. Así ordenan y comparan como texto, sin conversiones.
- Booleanos en `INTEGER` 0/1. Estados y tipos en minúscula con guion bajo: `activo`/`cerrado` para el curso, `abierto`/`cerrado` para el trimestre.
- **Las cadenas no se bifurcan:** `asignacion_trimestral.asignacion_anterior_id` y `curso_academico.curso_anterior_id` son `UNIQUE`, de modo que una asignación o un curso no pueden ser el origen de dos continuaciones. Recorrer el historial hacia atrás da siempre un único camino.
- Una evaluación inicial y un programa como mucho por curso; un objetivo como mucho una vez por trimestre; una sola plantilla activa por tipo de documento.
- Sin índices por rendimiento: a esta escala no se justifican (P9). Los únicos índices son los que nacen de restricciones de unicidad.

**Código interno** (T2.1, `002_codigo_interno.sql`):

- Formato `A-01`, `A-02`… `A-99`, y después `A-100` sin más. No lleva nada que identifique: ni iniciales, ni año de nacimiento, ni curso. Solo el orden de alta.
- Lo asigna la aplicación al dar de alta; ella no lo elige.
- **Nunca cambia:** un disparador de la base rechaza cualquier modificación, aunque se intente por fuera de la aplicación.
- **Nunca se reutiliza:** el último número entregado vive en `secuencia_codigo`, separado de los alumnos, y no puede retroceder. Aunque algún día se borre un alumno, su número no vuelve a darse. Es lo que da continuidad a todo lo que sale del equipo: `A-07` es siempre la misma persona.

**Un solo curso activo por alumno** (T2.3, `003_curso_activo_unico.sql`): un índice único parcial sobre `curso_academico (alumno_id) WHERE estado = 'activo'`. Para abrir el siguiente curso hay que cerrar antes el tercer trimestre del actual. Así cada pantalla sabe sin ambigüedad cuál es el curso vigente de un alumno.

---

## 5. Módulo de documentos

Aislado tras una interfaz, porque es lo único bloqueado por material pendiente.

**Funcionamiento:** se parte del `.docx` real de la profesional, con marcadores insertados donde van los datos variables. La aplicación sustituye los marcadores y produce el fichero final. No se reconstruye el documento, se rellena el suyo, de modo que logo, membrete, firma, tipografías y márgenes se conservan intactos sin trabajo adicional.

**Consecuencia deseada:** ella puede seguir editando el diseño en Word sin depender de nosotros, mientras respete los marcadores.

**Mientras no lleguen las plantillas:** el módulo se implementa contra una plantilla de prueba propia. Cuando lleguen las suyas, se sustituyen los ficheros y se ajustan los marcadores. No cambia código.

**Pseudonimización (P6):** filtro obligatorio en la salida hacia el exterior. La sustitución del nombre por el código interno no es una opción configurable ni un paso que ella deba recordar; es la única ruta posible hacia fuera.

Sustituye nombre y apellidos del alumno del documento, con sus variantes de acento, orden y separación. **No** detecta nombres de terceros: es una limitación decidida, documentada en P6, no un defecto por corregir. El filtro es una función pura de la capa de dominio, sin dependencias, para que pueda probarse a fondo y reutilizarse dondequiera que aparezca una salida nueva.

---

## 6. Estrategia de pruebas

**Se prueba lo que falla en silencio y se descubre tarde.** No hay pruebas de interfaz: la interfaz se valida con ella, que es más barato y más informativo, y además es justo lo que hay que poder rehacer sin fricción (P3).

Alcance con pruebas automáticas:

| Qué | Por qué |
|---|---|
| Capa de dominio completa | Es la única capa sin dependencias; probarla es trivial y no probarla, injustificable |
| Cadena de arrastre | Un enlace mal formado corrompe años de historial y no da síntoma hasta que ella consulta el recorrido |
| Verificación de cierre | Es el valor central del sistema y sustituye a un juicio humano. Si miente, miente con autoridad |
| Regla de cierre bloqueante | Un fallo aquí permite cerrar trimestres incompletos, que es exactamente lo que se venía a evitar |
| Filtro de pseudonimización | Un fallo saca un nombre fuera del equipo. Se prueba con nombres compuestos, acentuados y con guion |
| Coherencia alumno/trimestre | Verifica que las claves redundantes no puedan divergir (ver §4) |

Fuera de las pruebas automáticas: interfaz, generación `.docx` (se valida abriendo el fichero) y empaquetado (se valida en un equipo Windows, T0.1).

El dominio debe poder probarse **sin base de datos y sin Electron**. Si una prueba de dominio necesita levantar SQLite, la separación de capas está mal hecha y eso es lo primero que hay que arreglar.

Desde T1.5 esto no depende de la buena voluntad: una prueba (`pruebas/dominio/aislamiento.test.ts`) revisa las importaciones de `src/main/dominio/` y falla si aparece cualquiera que salga de la carpeta. El vocabulario de la rúbrica vive en el dominio y la prueba del esquema lo importa de allí, de modo que base de datos y dominio no pueden separarse sin que salte una prueba.

---

## 7. Estructura del proyecto

```
src/
  main/              proceso principal
    dominio/         entidades y reglas
    servicios/       casos de uso
    persistencia/    SQLite, migraciones, repositorios
    documentos/      plantillas y generación
    ipc/             puente con la interfaz
  renderer/          interfaz
    pantallas/
    componentes/
    estado/
  compartido/        tipos comunes
pruebas/
  dominio/
  servicios/
recursos/
  plantillas/
  migraciones/
```

---

## 8. Riesgos técnicos

| Riesgo | Mitigación |
|---|---|
| Compilación nativa de SQLite al empaquetar | Resuelto en T1.2: better-sqlite3 13 trae binarios precompilados (N-API) para Windows x64 dentro del paquete npm. Se desactiva la recompilación de electron-builder (`npmRebuild: false`), que intentaba compilar desde fuente y no puede desde macOS. Confirmado en Windows real el 2026-09-25 |
| Los marcadores en `.docx` se fragmentan al editar en Word | Normalizar la plantilla antes de usarla; validar al cargarla |
| Las plantillas exigen campos no previstos | El esquema es extensible; migraciones desde el inicio |
| El vocabulario inicial de sesión no encaja con su forma de trabajar | Editable desde la aplicación, no fijo en código |

Lo que sí falló, al probar temprano con un paquete vacío, fue la desinstalación del instalador NSIS (ver §1), resuelto pasando a distribución en zip.

---

## 9. Orden de construcción

1. Esqueleto y paquete portable funcionando en un equipo Windows real ✅
2. Persistencia, migraciones y copias de seguridad ✅
3. Alumnos y ciclo de curso ✅ *(el programa en la pantalla del curso llega con T3.1)*
4. Programa de intervención y objetivos
5. **Registro rápido de sesión** — con medición contra el criterio de los dos minutos
6. Cierre de trimestre, verificación y arrastre
7. Módulo de documentos y actas
8. Exportación

Los pasos 1 y 5 son los que conviene validar con ella antes de seguir. El resto puede construirse seguido.
