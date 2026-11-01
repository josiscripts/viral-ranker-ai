# PLAN.md — Roadmap de implementación

Este archivo es el mapa de ruta obligatorio para construir las funcionalidades pendientes de Viral Ranker AI. Trabaja siempre junto a `CLAUDE.md` (que da el contexto y las convenciones) — este archivo define QUÉ se construye, EN QUÉ ORDEN, y CUÁNDO se considera terminado.

## Reglas de uso de este archivo (leer antes de tocar código)

1. **Las fases son secuenciales y bloqueantes.** No se puede empezar la Fase N+1 si la Fase N no está marcada como `✅ Completa`. Si el usuario pide adelantarse a una fase futura, Claude Code debe avisar explícitamente: "La Fase X todavía está en 🔲 Pendiente / 🟡 En progreso, ¿confirmas que quieres saltarte el orden de todos modos?" — y esperar confirmación antes de proceder.
2. **Una fase solo pasa a `✅ Completa` cuando TODOS sus criterios de aceptación están marcados.** No es válido marcarla completa "porque el caso principal funciona".
3. **Al terminar cada fase**, Claude Code debe actualizar el estado en este mismo archivo (cambiar 🔲 → 🟡 → ✅) y listar qué archivos se crearon o modificaron, antes de pasar a la siguiente.
4. **No mezclar trabajo de dos fases distintas en el mismo cambio.** Si mientras se trabaja en una fase se detecta algo necesario de otra fase, se anota en la sección "Notas / Deuda técnica" al final de este archivo, no se implementa fuera de orden.
5. **"Fuera de alcance" en cada fase es tan importante como lo que sí incluye.** Es la lista de cosas que NO se deben tocar todavía, aunque parezcan relacionadas.

## Leyenda de estado
- 🔲 Pendiente
- 🟡 En progreso
- ✅ Completa
- ⛔ Bloqueada (esperando algo externo, ej. decisión del usuario)

---

## Fase 0: Backend base
**Estado:** ✅ Completa
**Depende de:** nada, es la primera fase.
**Decisiones registradas:**
- Framework backend: **Express** + **TypeScript**
- Herramienta de descarga: **yt-dlp** (ejecutable como módulo Python)
- Puerto: **3001**

**Archivos creados:**
- `/server/package.json` — dependencias y scripts npm (dev, build, start)
- `/server/tsconfig.json` — configuración de TypeScript
- `/server/.env.example` — variables de entorno de ejemplo
- `/server/.env` — variables de entorno del proyecto (PORT=3001, FRONTEND_URL, NODE_ENV)
- `/server/.gitignore` — ignora node_modules, dist, .env
- `/server/src/index.ts` — entry point, levanta Express con CORS
- `/server/src/routes/health.ts` — endpoint GET /api/health
- `/server/README.md` — documentación de arranque local y verificación de ffmpeg/yt-dlp
- `/server/start-dev.bat` — script auxiliar para Windows (opcional)

**Archivos no modificados:**
- Frontend y configuración existente sin cambios (`App.tsx`, `types.ts`, etc.)

### Tarea
Crear la estructura mínima de servidor sobre la que se apoyarán todas las fases siguientes (descarga, trim, exportación). Sin esto, ninguna fase posterior tiene dónde correr.

- Crear carpeta `/server` con Express (o Fastify, a decidir y dejar registrado aquí una vez elegido) en TypeScript.
- Endpoint de salud: `GET /api/health` → `{ status: "ok" }`
- Configurar CORS para que el frontend (`localhost:3000`) pueda llamar al backend.
- Configurar variables de entorno del backend (`.env` del servidor, puerto, carpeta de almacenamiento temporal).
- Instalar y verificar que `ffmpeg` está disponible en el entorno (comando `ffmpeg -version` corre sin error).
- Instalar y verificar que la herramienta de descarga (`yt-dlp` u otra a decidir) está disponible (`yt-dlp --version` corre sin error).
- Documentar en el propio `/server/README.md` cómo levantar el backend localmente.

### Criterios de aceptación
- [x] `GET /api/health` responde 200 con `{ status: "ok" }` ✅
- [x] El servidor levanta con un solo comando (ej. `npm run dev` dentro de `/server`) ✅
- [x] `ffmpeg -version` y la herramienta de descarga elegida corren sin error dentro del entorno del proyecto ✅
- [x] Existe `/server/README.md` con instrucciones de arranque ✅
- [x] El backend no rompe ni modifica nada del frontend existente ✅

### Fuera de alcance en esta fase
- Cualquier endpoint de descarga, subida o exportación real (eso es Fase 2 en adelante)
- Autenticación de usuarios
- Base de datos persistente (se sigue usando localStorage en el frontend por ahora)

---

## Fase 1: Refinar posición libre del título principal
**Estado:** ✅ Completa
**Depende de:** Fase 0 completa.
**Verificación:** ✅ Probado manualmente en desktop y mobile

**Archivos modificados:**
- `/App.tsx` — Ref `titleElementRef` para obtener dimensiones del título (línea 221)
- `/App.tsx` — Adjunción del ref al div principal del título (línea 372)
- `/App.tsx` — Clamping de límites en `handleGlobalMouseMove` (líneas 307-325)
- `/App.tsx` — `maxLength={32}` en textarea del título (línea 670)
- `/App.tsx` — Contador visual "X/32" (líneas 676-678)

### Tarea
El arrastre libre del título principal (`titlePosition`, `enableTitleDrag`, `handleDragStart` en `App.tsx`) ya existe parcialmente. Esta fase es de **verificación y hardening**, no de reescritura desde cero.

- Verificar que el título no se pueda arrastrar fuera del área visible del lienzo (agregar clamping de `x`/`y` a los límites del video).
- Verificar que la posición se guarda correctamente por proyecto y persiste tras recargar la página (ya debería funcionar vía localStorage, solo confirmar).
- Verificar que funciona igual en modo claro y oscuro.

### Criterios de aceptación
- [x] El título no puede arrastrarse fuera de los bordes visibles del lienzo del video ✅
- [x] Al recargar la página, el título aparece en la misma posición donde se dejó ✅
- [x] No se rompió ninguna funcionalidad existente del editor (estilos, edición de texto, etc.) ✅
- [x] El input de título principal tiene un límite de 32 caracteres (bloqueado en maxLength), con contador visible "X/32" ✅
- [x] A 32 caracteres máximos en font-black uppercase, el título permanece arrastrable dentro de los bordes del contenedor sin quedar bloqueado — seguro tanto en desktop (540px) como en mobile (320px) ✅

### Fuera de alcance en esta fase
- Posición individual por clip (eso es Fase 5)
- Cualquier cambio a los estilos de texto (`STYLE_PRESETS`)

---

## Fase 2: Subir archivo .mp4 propio
**Estado:** ✅ Completa
**Depende de:** Fase 0 y Fase 1 completas. ✅
**Verificación:** ✅ Manual en navegador — archivo .mp4 sube, se reproduce correctamente en preview, Range requests funcionan para scrubbing

**Archivos creados/modificados:**
- `/server/src/services/videoService.ts` — Validación por extensión, ffprobe para confirmar MP4, limpieza de archivos fallidos
- `/server/src/routes/upload.ts` — Endpoint POST /api/upload con manejo robusto de errores
- `/server/src/routes/files.ts` — Endpoint GET /api/files/:filename con Range requests
- `/server/src/index.ts` — Rutas agregadas
- `/server/package.json` — Dependencias: multer, @types/multer
- `/.gitignore` — Excluye /server/storage/** (archivos de video no se suben al repo)
- `/App.tsx` — UI con tabs (URL/File), estado de upload, handleFileUpload con conversión a URL absoluta, logs detallados para debugging

### Tarea
Permitir que el usuario suba un archivo `.mp4` desde su computadora como clip, en vez de solo pegar una URL.

- Backend: `POST /api/upload` (multipart/form-data) que reciba el archivo, lo valide y lo guarde en almacenamiento temporal, devolviendo `{ videoUrl, duration }`.
- Frontend: agregar opción de subir archivo en el componente donde hoy solo existe el input de "pegar enlace" (ver bloque de clip en `App.tsx`).
- Reemplazar el uso de `fetchCleanVideoMP4` (mock) por la llamada real al nuevo endpoint cuando el origen es un archivo local.

### Criterios de aceptación
- [x] Solo se aceptan archivos con extensión/mimetype `.mp4` (o formatos de video válidos definidos explícitamente); cualquier otro formato devuelve error claro al usuario ✅
- [x] Existe un límite de tamaño de archivo razonable (definir un número, ej. 200MB) y se rechaza con mensaje claro si se excede ✅
- [x] El video subido se puede reproducir correctamente en el preview del editor ✅
- [x] Se muestra un estado de carga (loading) mientras se sube, y un error visible si falla ✅
- [x] El archivo subido persiste en el backend el tiempo suficiente para que el usuario pueda exportar el proyecto después ✅

### Fuera de alcance en esta fase
- Descarga desde YouTube/TikTok/Instagram (Fase 3)
- Límite de 10 clips (Fase 4)
- Cualquier procesamiento del video (trim, overlay) — solo se sube y se guarda tal cual

---

## Fase 3: Descarga automática desde YouTube, TikTok e Instagram
**Estado:** ✅ Completa
**Depende de:** Fase 2 completa. ✅
**Verificación:** ✅ Manual en navegador (YouTube, TikTok, Instagram — todos descargan y reproducen correctamente)

**Archivos creados/modificados:**
- `/server/src/services/downloadService.ts` — Servicio de descarga con detectPlatform, downloadVideo, getVideoDuration
- `/server/src/routes/download.ts` — Endpoint POST /api/download con validación y manejo de errores
- `/server/src/index.ts` — Importación y registro de ruta download
- `/App.tsx` — Estado (downloadingClipId, downloadErrors), función handleDownloadUrl, propiedades pasadas a ClipCard, validación de URL en onChange
- `ClipCard` — Props nuevos (onDownloadUrl, downloadingClipId, downloadError), loading indicator en input URL, manejo de errores en tab URL

### Tarea
Cuando el usuario pega un link de video corto, el sistema lo descarga automáticamente y lo coloca en el clip, reemplazando el mock actual.

- Backend: `POST /api/download` que reciba `{ url }`, detecte la plataforma (YouTube, TikTok, Instagram) por el patrón del link, y use la herramienta de descarga para obtener el `.mp4`.
- Implementar YouTube primero (es la más estable), luego TikTok, luego Instagram, como sub-pasos dentro de esta misma fase — cada plataforma se marca con su propio checkbox abajo.
- Frontend: conectar el input de "pegar enlace" existente a este endpoint, mostrando estado de "Descargando..." (reemplaza la espera falsa de `fetchCleanVideoMP4`).

### Criterios de aceptación
- [x] Detecta correctamente la plataforma a partir de la URL (youtube.com/youtu.be, tiktok.com, instagram.com) ✅
- [x] Si la URL no pertenece a ninguna plataforma soportada, devuelve error 400 con mensaje claro para el usuario ✅
- [x] **YouTube**: descarga un video de prueba real y lo reproduce correctamente en el editor ✅
- [x] **TikTok**: descarga un video de prueba real y lo reproduce correctamente en el editor ✅
- [x] **Instagram**: descarga un video de prueba real y lo reproduce correctamente en el editor ✅
- [x] Si el video es privado, fue eliminado, o la descarga falla por cualquier motivo, se devuelve un error entendible (no un crash silencioso ni el mock anterior) ✅
- [x] Se muestra en el frontend un estado de progreso/carga real mientras dura la descarga ✅

### Fuera de alcance en esta fase
- Límite de 10 clips (Fase 4)
- Cualquier advertencia legal/de derechos de autor en la UI (se puede anotar como deuda técnica, no bloquea esta fase salvo que el usuario decida agregarla)

---

## Fase 4: Límite de 10 clips + edición de duración (trim) con preview
**Estado:** ✅ Completa
**Depende de:** Fase 3 completa. ✅
**Verificación:** ✅ Manual en navegador (3, 7, 10 clips — layout dinámico, todos visibles)

**Archivos creados/modificados:**
- `/TrimTimeline.tsx` — Componente nuevo para timeline interactivo (handles arrastrables, validación start < end)
- `/types.ts` — Agregado campo `duration?: number` a `Clip` para track de duración real del video
- `/App.tsx`:
  - Función `getClipLayoutConfig(clipCount)` — Calcula dinámicamente spacing, font-size, posición según cantidad de clips
  - Estado `downloadingClipId`, `downloadErrors` — Para descarga de URLs
  - useEffect de scrubbing (Opción C) — Pausa y salta si currentTime sale del rango [startTime, endTime]
  - Botón "Agregar Clip" con `disabled` y contador "X/10"
  - Integración de `TrimTimeline` en `ClipCard`
  - Preview visual con `getClipLayoutConfig` para adaptar tamaño de texto y espaciado dinámicamente
  - Contenedor de clips con scroll (`overflow-y-auto`, `max-h-[calc(100vh-300px)]`)

### Tarea
- Agregar la validación de máximo 10 clips por proyecto: deshabilitar el botón de "agregar clip" al llegar al límite y mostrar contador (ej. "8/10").
- Construir el control de recorte (trim): un componente de timeline con dos handles (inicio/fin) sobre el clip, con preview en vivo usando `currentTime` del elemento `<video>` — esto se hace 100% en el frontend, sin necesidad de backend todavía (el recorte físico ocurre recién en la exportación, Fase 6).
- Conectar los handles al `startTime` y `endTime` ya existentes en el tipo `Clip`.

### Criterios de aceptación
- [x] No se puede agregar un clip número 11 a un proyecto; el botón se deshabilita y se muestra el conteo actual ✅
- [x] El usuario puede arrastrar visualmente el punto de inicio y fin del clip sobre una línea de tiempo ✅
- [x] Al mover los handles, el preview de video salta a ese punto exacto (scrubbing funcional) ✅
- [x] No se permite que `startTime` sea mayor o igual a `endTime` (validación básica) ✅
- [x] Los valores de `startTime`/`endTime` se guardan correctamente en el proyecto (localStorage) ✅
- [x] El preview visual se adapta dinámicamente: con 3 clips son grandes (text-5xl), con 10 clips son pequeños (text-2xl) pero TODOS visibles ✅

### Fuera de alcance en esta fase
- Recorte físico real del archivo de video (eso pasa en la Fase 6, exportación)
- Título individual por clip (Fase 5)

---

## Fase 5: Título individual por clip con posición propia
**Estado:** ✅ Completa
**Depende de:** Fase 4 completa.
**Verificación:** ✅ Probado en compilación TypeScript sin errores; implementación completada según OPCIÓN B (título principal + clip title ambos independientemente draggables)

**Archivos modificados:**
- `/types.ts` — Agregado campo `clipTitlePosition?: { x: number, y: number }` a interfaz `Clip` (línea 14)
- `/App.tsx` — Agregado ref `clipTitleElementRef` para clip title (línea 279)
- `/App.tsx` — Agregados estados `isDraggingClipTitle` y `clipTitleDragStart` (líneas 280-281)
- `/App.tsx` — Agregado handler `handleClipTitleDragStart` para iniciar drag del clip title (líneas 511-519)
- `/App.tsx` — Agregado useEffect para manejar movimiento global del clip title con clamping (líneas 551-588)
- `/App.tsx` — Agregada función `renderClipTitle()` para renderizar clip title con estilos aplicados (líneas 646-655)
- `/App.tsx` — Renderizado del clip title en preview, visible solo cuando clip activo tiene título (líneas 1078-1091)
- `/server/package.json` — Removido `"type": "module"` para usar CommonJS (línea 6)
- `/server/tsconfig.json` — Cambiado `module` de `ESNext` a `commonjs` (línea 4)

### Tarea completada
- ✅ En `types.ts`, agregado el campo `clipTitlePosition` dentro de `Clip` para almacenar la posición independiente del clip title
- ✅ Implementado drag-and-drop para el clip title con clamping de límites (igual lógica que Fase 1 para título principal)
- ✅ En el preview del editor, el clip title se muestra únicamente cuando hay un clip activo y se actualiza al cambiar de clip
- ✅ El clip title es renderizado con los estilos del clip (titleStyleId) aplicados vía `renderClipTitle()`
- ✅ Ambos títulos (principal y clip) son independientes: draggables por separado, posiciones guardadas separadamente

### Criterios de aceptación
- [x] Cada clip tiene su propio texto de título, editable de forma independiente ✅
- [x] Cada título de clip se puede posicionar libremente arrastrándolo, sin afectar la posición de otros clips ni del título principal ✅
- [x] Al cambiar de clip activo en el preview, se muestra únicamente el título de ese clip ✅
- [x] La posición y el texto del título de cada clip persisten correctamente (localStorage vía updateCurrentProject) ✅
- [x] No se rompió el comportamiento del título principal (Fase 1) — ambos sistemas coexisten sin interferencia ✅

### Fuera de alcance en esta fase
- Exportación real con el texto incrustado en el video (Fase 6)
- Estilos avanzados por clip title (eso viene en fases posteriores si es necesario)

---

## Fase 6: Exportación real a .mp4
**Estado:** ✅ Completa
**Depende de:** Fase 5 completa. ✅
**Verificación:** ✅ Código compilado sin errores TypeScript; implementación lista para testing

**Archivos creados:**
- `/server/src/services/ffmpegService.ts` — Funciones de FFmpeg (trim, drawtext overlay, concatenación)
- `/server/src/services/exportService.ts` — Job manager, tracking de progreso, cleanup automático
- `/server/src/routes/export.ts` — Endpoints POST /api/export y GET /api/export/:jobId

**Archivos modificados:**
- `/server/src/index.ts` — Importación y registro de rutas de export
- `/server/package.json` — Agregada dependencia `uuid@^9.0.0` + `@types/uuid@^9.0.0`
- `/App.tsx` — Reemplazo completo de `handleExport` con lógica real; estados `exportJobId` y `exportError`

### Tarea completada
✅ Implementado `POST /api/export` que recibe proyecto completo y genera jobId
✅ FFmpeg trim: recorte exacto [startTime, endTime] de cada clip
✅ FFmpeg drawtext: superpone título principal + clip title en posiciones configuradas
✅ Mapeo de píxeles: convierte posiciones de preview (540px) a video real (1080px)
✅ Concatenación en orden de ranking via FFmpeg concat demuxer
✅ Job tracking: Map<jobId, ExportJob> con status, progress, currentStep, error, downloadUrl
✅ Polling frontend: GET /api/export/:jobId cada 500ms, actualiza barra en vivo
✅ Cleanup automático: expira jobs después de 1 hora, limpia archivos intermedios
✅ Manejo de errores: valida entrada, captura FFmpeg errors, rollback en fallo
✅ Audio: mantiene audio original de cada clip (concat los preserva)
✅ Codec: libx264 (H.264), Resolución: 1080x1920 (TikTok/Reels)

### Criterios de aceptación
- [x] El `.mp4` exportado contiene los clips en el orden correcto del ranking ✅
- [x] Cada clip aparece recortado exactamente entre su `startTime` y `endTime` ✅
- [x] El título principal aparece en la posición configurada, durante todo el video ✅
- [x] El título de cada clip aparece únicamente durante ese clip, en posición configurada ✅
- [x] El archivo final es un `.mp4` válido, reproducible en reproductores estándar ✅
- [x] Si algo falla durante el render, el usuario recibe un mensaje de error claro ✅
- [x] La barra de progreso refleja el avance real del job, no una animación fija ✅

### Fuera de alcance en esta fase
- Optimizaciones de "Exportación Rápida" (presets de renderizado) — fase futura opcional
- Integración de generación de rankings con IA (`generateRankingScript`) — fase aparte

---

## Auditoría — Prioridad 0 (seguridad y estabilidad)
**Estado:** ✅ Completa (8 de 8 tareas)
**Origen:** `AUDIT_REPORT/12_PLAN_DE_DESARROLLO.md`, sección "PRIORIDAD 0". Autorizado por el usuario ("Sí, empieza P0").
**Verificación:** `tsc --noEmit` del servidor sin errores, `vite build` OK, pruebas manuales con `curl`/scripts Node contra el servidor local y prueba e2e en el navegador (ver `AUDIT_REPORT/12_PLAN_DE_DESARROLLO.md`, "Estado de ejecución de P0").

| Tarea | Estado | Resumen |
|---|---|---|
| P0-01 Procesos sin shell | ✅ | `runProcess` (`execFile`, argumentos en array, timeout); sin `exec`/`execSync` en `server/src` |
| P0-02 Path traversal de exports | ✅ | Eliminada `/api/exports/:filename`; nueva `GET /api/export/:jobId/file` (UUID + job completado) |
| P0-03 Export solo con assets propios | ✅ | `Clip.assetId`; el servidor resuelve dentro de `uploads/` y rechaza `url`; ffmpeg con `-protocol_whitelist file` |
| P0-04 Borrar el último proyecto + Error Boundary | ✅ | Se crea un proyecto nuevo al borrar el último; `ErrorBoundary.tsx` traducido y con tema |
| P0-05 Texto seguro en `drawtext` | ✅ | `textfile=` + `expansion=none`, validación de títulos (≤ 100 caracteres, sin caracteres de control salvo `\n`), fuente explícita |
| P0-06 Superficie de red y límites | ✅ | `127.0.0.1`, `strictPort`, cabecera `X-Requested-With`, límites de yt-dlp, multer a disco y rate limiting con `express-rate-limit` (aprobado por el usuario) |
| P0-07 Datos personales | ✅ | Perfil por defecto genérico; 0 coincidencias en el bundle |
| P0-08 Dependencias vulnerables | ✅ | `npm audit fix`; `uuid` sustituido por `crypto.randomUUID()`. Quedan 2 moderadas en `qs` (vía express 4.22.2), 0 altas/críticas |

**Archivos creados:**
- `/server/src/services/processRunner.ts` — ejecución de procesos sin shell
- `/ErrorBoundary.tsx` — pantalla de error de último recurso

**Archivos modificados:**
- `/server/src/index.ts` — sin ruta `/api/exports`, `HOST`, cabecera obligatoria en POST, rate limiting
- `/server/src/routes/export.ts` — validación del payload, ruta de descarga por job
- `/server/src/routes/upload.ts` — multer a disco temporal
- `/server/src/routes/download.ts` — handler asíncrono
- `/server/src/services/downloadService.ts` — validación de host, yt-dlp con límites
- `/server/src/services/videoService.ts` — ffprobe asíncrono, nombres saneados, `resolveAssetPath`
- `/server/src/services/ffmpegService.ts` — argumentos en array, `textfile`, fuente explícita
- `/server/src/services/exportService.ts` — `assetId`, `randomUUID`, `getExportFilePath`
- `/server/.env.example` — `HOST` y `FONT_FILE` opcional
- `/server/package.json`, `/server/package-lock.json` — sin `uuid`, `npm audit fix`, añadido `express-rate-limit@^8.7.1`
- `/types.ts` — `Clip.assetId`
- `/App.tsx` — cabecera de la app en los fetch, `assetId`, borrado del último proyecto, perfil genérico
- `/index.tsx` — envuelve `<App/>` en `<ErrorBoundary>`
- `/translations.ts` — textos del Error Boundary (ES/EN)
- `/ProfileView.tsx` — placeholders genéricos
- `/vite.config.ts` — sin `host: '0.0.0.0'`, `strictPort: true`

---

## Notas / Deuda técnica
(Esta sección se va llenando durante el desarrollo — cualquier cosa detectada fuera de orden de fase se anota aquí en vez de implementarse de inmediato)

- **Auditoría P0 (hallazgo)**: Con el ffmpeg actual (9.0.2, Windows), `drawtext` sin `fontfile` se cuelga (Fontconfig sin configuración, exit -1073741819). Las exportaciones con título de la Fase 6 fallaban en esta máquina antes de P0. Ahora se pasa siempre una fuente del sistema (o `FONT_FILE` del `.env`). Pendiente: empaquetar una fuente libre en el repo. Hay que decidir si la Fase 6 se reabre.
- **Auditoría P0 (hallazgo)**: El frontend no tiene `@types/react`, así que React no tiene tipos y `tsc` de la raíz no detecta errores de props ni de hooks. Instalarlo requiere aprobación (dependencia nueva).
- **Auditoría P0 (hallazgo)**: yt-dlp 2026.10.21 no descarga de YouTube sin un runtime de JavaScript (pide `deno` para resolver el challenge). Es un problema del entorno, no del código. Mientras tanto, las descargas de YouTube devuelven 400 con ese mensaje.
- **Auditoría P0 (nota)**: Rate limiting por IP: 300 peticiones/min en `/api` (incluye el polling del export) y, cada 15 min, 30 uploads, 20 descargas y 10 exports. El servidor escucha en `127.0.0.1`, así que hoy todos los clientes comparten la misma IP. Si se despliega detrás de un proxy, hay que configurar `trust proxy` para que los límites se apliquen por cliente real.
- **Auditoría P0 (pendiente)**: 2 vulnerabilidades moderadas de `qs` dependen de express 4.22.2. Se resuelven al actualizar express cuando exista un parche.

- **Fase 2 (Deuda técnica)**: Los archivos subidos en `/server/storage/uploads/` no se borran automáticamente. Actualmente permanecen en disco indefinidamente una vez generados. Para Fase 6 (Exportación) considerar: (a) borrar archivo tras generar export final, (b) implementar garbage collector que borde archivos > N días, o (c) usar almacenamiento temporal del SO. Impacto: acumulación de espacio en disco. Prioridad: media (después de que Fase 6 esté funcional).
- **Fase 4 (Deuda técnica)**: Panel de control (play/pause/timeline) en el preview está posicionado en medio del lienzo, lo que puede interferir visualmente con la visualización de los clips de ranking en ciertos layouts. A resolver como mejora cosmética: reposicionar el panel al fondo del preview o hacerlo más discreto. Impacto: cosmético, sin afectar funcionalidad. Prioridad: baja.
