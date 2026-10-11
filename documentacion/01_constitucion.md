# Constitución del proyecto

Principios no negociables. Cualquier decisión de diseño o implementación que los contradiga se rechaza, aunque sea técnicamente superior.

> **Cambio de alcance (2026-10-11).** Tras usarla, ella pidió que la aplicación se centre en el registro de las sesiones: **nada de informes ni plantillas de Word**. Lo que necesita es poder sacar, al acabar cada trimestre, un fichero por alumno con todo lo que registró. Los principios siguen en vigor; P4, P6 y P7 explican abajo cómo les afecta.

---

## P1 — Los datos son de ella

La profesional debe poder llevarse todos sus datos en cualquier momento, sin depender de nadie.

**Origen:** los registros son parte de su trabajo y quiere conservar el control sobre ellos.

**Implicaciones:** almacenamiento en un fichero que ella controla. Exportación completa siempre disponible. Ningún dato imprescindible fuera de su equipo. Sin cuentas ni licencias que caduquen.

---

## P2 — Local antes que conectado

La aplicación funciona íntegramente sin conexión a internet. Cualquier funcionalidad que dependa de la red es opcional y su ausencia no impide trabajar.

**Origen:** *"Prefiero en local"*.

**Implicaciones:** sin servidor propio, sin sincronización, sin dependencia de servicios externos para el funcionamiento normal.

---

## P3 — Registrar tiene que costar menos que no registrar

El registro de una sesión debe ser tan rápido que no exista la tentación de posponerlo. Si registrar cuesta más de dos minutos, la funcionalidad ha fracasado, por completa que sea.

**Origen:** a la pregunta de qué funcionalidad salvaría si solo pudiera tener una, respondió que la facilidad de registro de datos.

**Implicaciones:** el registro rápido es la pantalla más importante del sistema. Cualquier campo adicional debe justificar su coste en segundos. Ante la duda, se deja fuera.

---

## P4 — Ella redacta, la aplicación no

El texto profesional lo escribe ella. La aplicación aporta datos, estructura y verificación, nunca sustituye su criterio ni su voz.

**Origen:** el criterio profesional es suyo, y el texto también.

**Implicaciones:** no se genera prosa clínica automáticamente. Desde el cambio de alcance, la aplicación tampoco redacta ni compone informes: guarda lo que ella escribe y se lo devuelve ordenado.

---

## P5 — Lo que es una consulta a los datos se responde con los datos

Si una pregunta puede responderse consultando la base de datos, se responde consultando la base de datos.

**Origen:** al cerrar un trimestre hay que saber si se cumplieron los objetivos y si se trabajó lo planificado. Es una comprobación factual.

**Implicaciones:** la verificación de cierre de trimestre es determinista y fiable.

---

## P6 — Nada sale identificado

Cualquier texto que la aplicación prepare para salir del equipo lleva el alumno sustituido por su código interno, sin excepción y sin que ella tenga que acordarse.

**Origen:** son datos de menores. Un código estable permite además referirse siempre al mismo alumno sin nombrarlo.

**Implicaciones:** la pseudonimización es automática y por defecto, no una opción que haya que activar.

**Desde el cambio de alcance:** ya no queda ninguna salida hacia fuera, porque se retiró la generación de documentos. La exportación del trimestre es su archivo personal en su propio equipo y lleva el nombre del alumno. Si en el futuro vuelve a aparecer una salida hacia el exterior, este principio se aplica tal cual.

**Alcance del filtro:** cubre el nombre y los apellidos del alumno al que pertenece el texto. Nada más.

**Riesgo asumido, decidido conscientemente:** los campos libres pueden contener nombres de terceros —hermanos, madres, profesionales externos, el propio centro— y el filtro no los detecta. Se acepta porque ampliarlo obligaría a mantener diccionarios o a añadir un paso de revisión, y ambas cosas encarecen la única ruta de salida por un riesgo que ella ya gestiona hoy al escribir. **Esta es una limitación conocida, no un descuido.** Si en el uso real aparecen nombres de terceros con frecuencia, se replantea entonces.

---

## P7 — Los documentos son vistas, no estructura

El modelo de datos no sabe nada de plantillas ni de formatos. Un documento es una proyección sobre los datos; los datos nunca se guardan preformateados para un documento concreto.

**Implicaciones:** la exportación del trimestre es una proyección sobre los datos. Cambiar su formato no toca el dominio, y los datos no se guardan pensando en cómo se van a exportar.

---

## P8 — Una sola usuaria

No hay roles, ni permisos, ni auditoría, ni acceso concurrente, ni cuentas de usuario.

**Origen:** *"La única"*. Nadie más accede a la aplicación.

**Implicaciones:** se elimina toda la complejidad asociada. Si algún día hiciera falta, se replantea entonces; no se construye "por si acaso".

---

## P9 — Escala pequeña, decisiones simples

Pocos alumnos activos, pocos objetivos por trimestre y pocas sesiones al día. Ninguna decisión debe justificarse por rendimiento, escalabilidad o volumen.

**Implicaciones:** ante dos opciones, gana siempre la más simple de entender y mantener.

---

## P10 — Respetar el vocabulario existente

La aplicación usa las palabras que ella ya usa. No se inventan estados, categorías ni nomenclatura nueva.

**Origen:** los estados de valoración (conseguido / no conseguido / pendiente de desarrollar) y los nombres de sus documentos son suyos y preexistentes.
