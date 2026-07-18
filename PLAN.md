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
**Estado:** 🔲 Pendiente
**Depende de:** Fase 4 completa.

### Tarea
- En `types.ts`, agregar el campo de posición dentro de `Clip` (no reutilizar el `titlePosition` del proyecto, que es del título principal).
- Permitir editar el título de cada clip por separado (el input ya existe parcialmente en `App.tsx`, hay que confirmar que guarda bien) y agregar la opción de arrastrar ese título específico sobre el lienzo, igual que se hizo con el título principal en la Fase 1.
- En el preview del editor, al reproducir/cambiar de clip activo, debe mostrarse el título correspondiente a ESE clip únicamente (no el de otro clip ni el título principal superpuesto de forma incorrecta).

### Criterios de aceptación
- [ ] Cada clip tiene su propio texto de título, editable de forma independiente
- [ ] Cada título de clip se puede posicionar libremente arrastrándolo, sin afectar la posición de otros clips ni del título principal
- [ ] Al cambiar de clip activo en el preview, se muestra únicamente el título de ese clip
- [ ] La posición y el texto del título de cada clip persisten correctamente (localStorage)
- [ ] No se rompió el comportamiento del título principal (Fase 1)

### Fuera de alcance en esta fase
- Exportación real con el texto incrustado en el video (Fase 6)

---

## Fase 6: Exportación real a .mp4
**Estado:** 🔲 Pendiente
**Depende de:** Fase 5 completa.

### Tarea
Reemplazar por completo el `handleExport` actual (barra de progreso falsa + descarga del video sin editar) por un proceso real en el backend:

- Backend: `POST /api/export` que reciba el `projectId` (o el proyecto completo) y, usando `ffmpeg`:
  1. Recorte cada clip según su `startTime`/`endTime`.
  2. Superponga el texto correspondiente (título principal en su posición + título de cada clip en la suya) sobre cada segmento.
  3. Concatene los clips en el orden del ranking.
  4. Genere el archivo `.mp4` final.
- Dado que el renderizado puede tardar, implementar el export como un job asíncrono: el endpoint devuelve un `jobId`, y el frontend consulta el estado (`GET /api/export/:jobId`) hasta que esté listo, mostrando el progreso real (no simulado).
- Frontend: conectar el botón de exportar existente a este flujo real, y descargar el archivo final cuando el job termine.

### Criterios de aceptación
- [ ] El `.mp4` exportado contiene los clips en el orden correcto del ranking
- [ ] Cada clip aparece recortado exactamente entre su `startTime` y `endTime`
- [ ] El título principal aparece en la posición configurada, durante todo el video (o donde se haya definido)
- [ ] El título de cada clip aparece únicamente durante ese clip, en la posición configurada para ese clip
- [ ] El archivo final es un `.mp4` válido, reproducible en reproductores estándar (VLC, navegador, etc.)
- [ ] Si algo falla durante el render (ffmpeg error, archivo corrupto, etc.), el usuario recibe un mensaje de error claro, no una barra de progreso que termina "exitosamente" sobre un resultado roto
- [ ] La barra de progreso mostrada en el frontend refleja el avance real del job de exportación, no una animación fija

### Fuera de alcance en esta fase
- Optimizaciones de "Exportación Rápida" (presets de renderizado) — se deja como fase futura opcional, no bloquea el cierre de esta fase
- Integración de generación de rankings con IA (`generateRankingScript`) — es una fase aparte, no forma parte de este roadmap de video

---

## Notas / Deuda técnica
(Esta sección se va llenando durante el desarrollo — cualquier cosa detectada fuera de orden de fase se anota aquí en vez de implementarse de inmediato)

- **Fase 2 (Deuda técnica)**: Los archivos subidos en `/server/storage/uploads/` no se borran automáticamente. Actualmente permanecen en disco indefinidamente una vez generados. Para Fase 6 (Exportación) considerar: (a) borrar archivo tras generar export final, (b) implementar garbage collector que borde archivos > N días, o (c) usar almacenamiento temporal del SO. Impacto: acumulación de espacio en disco. Prioridad: media (después de que Fase 6 esté funcional).
- **Fase 4 (Deuda técnica)**: Panel de control (play/pause/timeline) en el preview está posicionado en medio del lienzo, lo que puede interferir visualmente con la visualización de los clips de ranking en ciertos layouts. A resolver como mejora cosmética: reposicionar el panel al fondo del preview o hacerlo más discreto. Impacto: cosmético, sin afectar funcionalidad. Prioridad: baja.
