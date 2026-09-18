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
| 1 — Cimientos | En curso: T1.1 (esqueleto) y T1.2 (persistencia y migraciones) hechas; siguiente T1.3 (esquema completo) |
| 2 a 7 | Pendientes |

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

### Migraciones

Cada cambio de esquema es un fichero nuevo en `recursos/migraciones/`, numerado sin huecos (`001_...sql`, `002_...sql`). Se aplican solas al arrancar, cada una en su propia transacción. Una migración ya publicada no se modifica nunca: se añade otra.

## Distribución

Se distribuye como **zip portable**, no como instalador: `npm run dist:win` genera `dist/Ariadne-<versión>-windows.zip`, que contiene una única carpeta `Ariadne/`.

- **Instalar:** descomprimir la carpeta donde se quiera y ejecutar `Ariadne.exe`. La primera vez, Windows SmartScreen avisa porque el ejecutable no está firmado (*Más información → Ejecutar de todas formas*).
- **Actualizar:** sustituir la carpeta por la de la nueva versión.
- **Desinstalar:** borrar la carpeta.

Los datos no viven en la carpeta de la aplicación, sino en `%APPDATA%\Ariadne\ariadne.sqlite` (o donde ella elija desde la propia aplicación), así que actualizar o borrar la aplicación nunca los toca.

El paquete se genera desde macOS sin Wine ni Rosetta. Se descartó el instalador NSIS porque electron-builder genera un desinstalador corrupto al compilar desde macOS; los detalles están en el [plan técnico](documentacion/03_plan.md#instalador-nsis-descartado-tras-t01).

## Documentación

1. [Constitución](documentacion/01_constitucion.md): principios no negociables.
2. [Especificación](documentacion/02_especificacion.md): qué hace la aplicación y por qué.
3. [Plan técnico](documentacion/03_plan.md): cómo se construye.

## Licencia

Proyecto privado, sin licencia de uso (`UNLICENSED`).
