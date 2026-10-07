# Ariadne

Aplicación de escritorio para Windows que ayuda a una orientadora de educación especial a registrar sus sesiones con alumnos, seguir los objetivos trimestrales de cada uno y generar su documentación sobre sus propias plantillas de Word.

El problema que resuelve no es la evaluación, sino la **captura**: si registrar una sesión cuesta más que no registrarla, acaba sin registrarse. El objetivo central es que registrar una sesión lleve menos de dos minutos.

## Principios

El proyecto se rige por una [constitución](documentacion/01_constitucion.md) de diez principios no negociables. Los que más condicionan el diseño:

- **Los datos son de ella.** Todo vive en un único fichero SQLite que puede copiar, llevarse en un USB o exportar. Sin cuentas ni servidor.
- **Local antes que conectado.** Funciona íntegramente sin internet.
- **Registrar tiene que costar menos que no registrar.** Cada campo justifica su coste en segundos.
- **Ella redacta, la aplicación no.** La aplicación aporta datos, estructura y verificación; nunca escribe prosa clínica.
- **Nada sale identificado.** Todo texto que sale del equipo lleva el nombre del alumno sustituido por su código interno, de forma automática.

## Estado

En construcción:

| Hito | Estado |
|---|---|
| 0 — Viabilidad en Windows | ✅ Cerrado |
| 1 — Cimientos | ✅ Cerrado |
| 2 — Alumnos y ciclo académico | ✅ Cerrado |
| 3 — Programa de intervención | ✅ Cerrado |
| 4 — Registro de sesión | En curso: T4.1 a T4.3 hechas (opciones, registro rápido, objetivos trabajados) |
| 5 a 7 | Pendientes |

Los cimientos están completos: empaquetado para Windows, base de datos con migraciones, el esquema entero, copias de seguridad con restauración y la capa de dominio con las reglas centrales.

Hoy la aplicación abre la **lista de alumnos**, con los que tienen curso activo arriba, los demás en una sección plegada y una búsqueda por nombre o código. Cada alumno con curso activo tiene su botón **Registrar sesión**: alumno y fecha ya puestos, sus palabras como botones que se marcan, los objetivos del trimestre para marcar los trabajados, y el trimestre deducido sin preguntar. Permite dar de alta a un alumno, que recibe su código interno (`A-01`, `A-02`…), y consultar y editar su ficha. La ficha muestra el historial de cursos del alumno, y cada curso tiene su propia pantalla: arriba, el trimestre en curso con sus objetivos; después sus tres trimestres, con fechas propuestas que ella corrige, su evaluación inicial, su programa de intervención con los objetivos de cada trimestre y sus actas de reunión. Los cursos cerrados se consultan igual, sin poder modificarse. En una esquina, **Opciones del registro** guarda las palabras que ella pulsará al registrar una sesión (vienen unas iniciales que ella ajusta), y **Copias de seguridad** muestra dónde viven los datos, permite cambiarlos de sitio y gestiona las copias. Las sesiones, el cierre de trimestre y los documentos llegan en los hitos siguientes.

Los cimientos están probados en un equipo Windows real con el paquete zip, incluida la base de datos SQLite empaquetada. Lo de los hitos 2 y 3 está probado en el Mac, pendiente de probar allí.

## Stack

Electron + TypeScript + React, con SQLite (`better-sqlite3`) como almacenamiento, compilado con electron-vite y probado con Vitest. Las razones de cada elección y las alternativas descartadas están en el [plan técnico](documentacion/03_plan.md).

## Desarrollo

Requisitos: Node.js 22 o superior y npm.

```bash
npm install
npm run dev         # arranca la aplicación en modo desarrollo, con recarga en caliente
npm test            # pruebas (Vitest)
npm run typecheck   # comprobación de tipos
npm run build       # compila a out/
npm run dist:win    # genera el paquete de Windows en dist/
```

### Estructura

```
src/
  main/              proceso principal: dominio, servicios, persistencia, documentos, ipc
  preload/           puente seguro entre la interfaz y el proceso principal
  renderer/          interfaz (React): pantallas, componentes, estado
  compartido/        tipos comunes, incluido el contrato de IPC
pruebas/             pruebas automáticas, por capa
recursos/
  migraciones/       cambios de esquema, NNN_descripcion.sql
  plantillas/        plantillas .docx
documentacion/       constitución, especificación y plan
```

Las capas dependen siempre hacia dentro (interfaz → servicios → dominio → persistencia). La interfaz corre aislada, sin acceso a Node ni a la base de datos, y se comunica con el proceso principal solo a través del contrato de `src/compartido/ipc.ts`.

**El dominio no importa nada fuera de su carpeta**: ni Electron, ni SQLite, ni otras capas. No es una recomendación, hay una prueba que revisa las importaciones y falla si alguna se escapa. Ahí viven el vocabulario de la rúbrica, la cadena de arrastre de objetivos, el calendario del curso y la regla de cierre de trimestre, y se prueban sin levantar nada.

### Migraciones

Cada cambio de esquema es un fichero nuevo en `recursos/migraciones/`, numerado sin huecos (`001_...sql`, `002_...sql`). Se aplican solas al arrancar, cada una en su propia transacción. Una migración ya publicada no se modifica nunca: se añade otra.

## Distribución

Se distribuye como **zip portable**, no como instalador: `npm run dist:win` genera `dist/Ariadne-<versión>-windows.zip`, que contiene una única carpeta `Ariadne/`.

- **Instalar:** descomprimir la carpeta donde se quiera y ejecutar `Ariadne.exe`. La primera vez, Windows SmartScreen avisa porque el ejecutable no está firmado (*Más información → Ejecutar de todas formas*).
- **Actualizar:** sustituir la carpeta por la de la nueva versión.
- **Desinstalar:** borrar la carpeta.

Los datos no viven en la carpeta de la aplicación, sino en `%APPDATA%\Ariadne\ariadne.sqlite` (o donde ella elija desde la propia aplicación), así que actualizar o borrar la aplicación nunca los toca.

Las copias de seguridad se guardan en una carpeta `copias/` junto a los datos: una al abrir la aplicación, conservando las diez últimas. Si mueve los datos a un USB, las copias van con ellos. Además puede guardar una copia donde quiera, y esa no entra en la rotación.

El paquete se genera desde macOS sin Wine ni Rosetta. Se descartó el instalador NSIS porque electron-builder genera un desinstalador corrupto al compilar desde macOS; los detalles están en el [plan técnico](documentacion/03_plan.md#instalador-nsis-descartado-tras-t01).

## Documentación

1. [Constitución](documentacion/01_constitucion.md): principios no negociables.
2. [Especificación](documentacion/02_especificacion.md): qué hace la aplicación y por qué.
3. [Plan técnico](documentacion/03_plan.md): cómo se construye.

## Licencia

Proyecto privado, sin licencia de uso (`UNLICENSED`).
