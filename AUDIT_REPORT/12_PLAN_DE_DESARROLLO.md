# 12 — Plan de desarrollo

## Principios
- El orden está pensado para que cada tarea se pueda integrar sin romper lo que ya funciona. **Primero tests de caracterización (P3-01a), después cambios.**
- Cada tarea es un cambio independiente y revisable. Se respeta la regla 4 de `PLAN.md`: no mezclar tareas.
- Las tareas marcadas con 🔶 dependen de una **decisión tuya** (ver 11 §4).
- Dificultad: **S** (< 2 h), **M** (½–1 día), **L** (2–4 días), **XL** (> 1 semana).
- Este roadmap **no** sustituye a `PLAN.md`: propone su continuación. Si lo apruebas, habría que reflejarlo allí como nuevas fases (y reabrir la Fase 6 como 🟡).

## Orden de ejecución recomendado

```
P3-01a (tests de humo) → P0-01 → P0-02 → P0-03 → P0-05 → P0-04 → P0-06 → P0-07 → P0-08
   → P1-01 → P1-07 → P1-05 → P1-06 → P1-08 → P1-09 → P1-10 → P1-02 → P1-03 → P1-04🔶
   → P2-* → P3-* (resto) → P4-*
```

---

## PRIORIDAD 0 — CRÍTICA

### P0-01 · Ejecutar procesos sin shell
- **Problema:** RCE por inyección de comandos (S-01, S-02, S-03).
- **Archivos:** `server/src/services/downloadService.ts`, `videoService.ts`, `ffmpegService.ts` y un nuevo `server/src/services/processRunner.ts`.
- **Solución:** un helper `runProcess(bin, args[], {timeoutMs})` sobre `spawn`/`execFile` **sin** `shell: true`, que devuelva una promesa con stdout, stderr y código. Sustituir todos los `exec`/`execSync`. Rutas y URLs como elementos del array, nunca concatenadas.
- **Dependencias:** P3-01a recomendado.
- **Dificultad:** M · **Prioridad:** P0.
- **Terminado cuando:** `grep -rn "exec(\|execSync(" server/src` no da resultados. Todas las llamadas usan `runProcess`.
- **Verificación:** tests unitarios con URL, título y nombre de archivo con `"`, `$()`, `&`, `` ` `` y saltos de línea, comprobando que se pasan literales. Subida, descarga y export manuales siguen funcionando.

### P0-02 · Cerrar el path traversal de `/api/exports`
- **Problema:** S-04 (confirmado).
- **Archivos:** `server/src/index.ts` (mover a `routes/export.ts`).
- **Solución:** `GET /api/export/:jobId/file` buscando el job y validando `jobId` con una regex UUID. Resolver la ruta y comprobar que empieza por `EXPORTS_DIR + sep`. Eliminar la ruta genérica `:filename`.
- **Dependencias:** ninguna · **Dificultad:** S · **Prioridad:** P0.
- **Terminado cuando:** `..%2F`, `..%5C`, ids inexistentes y nombres arbitrarios devuelven 400 o 404.
- **Verificación:** test de integración (supertest) y repetir los `curl` del informe 09.

### P0-03 · Export solo con assets propios (anti-SSRF)
- **Problema:** S-05.
- **Archivos:** `exportService.ts`, `routes/export.ts`, `App.tsx` (`handleExport`), `types.ts`.
- **Solución:** añadir `Clip.assetId` (el nombre de archivo devuelto por upload y download). El export envía `assetId`, el servidor valida `^[\w.-]+\.mp4$`, resuelve dentro de `UPLOAD_DIR` y comprueba que exista. Rechazar `url`. ffmpeg con `-protocol_whitelist file`. Migración: extraer `assetId` de las `clip.url` existentes (`/api/files/<x>`).
- **Dependencias:** P0-01 · **Dificultad:** M · **Prioridad:** P0.
- **Terminado cuando:** un export con `assetId` que apunta fuera de `UPLOAD_DIR`, o con una URL `http(s)`, devuelve 400.
- **Verificación:** tests de integración y un export manual de un proyecto existente.

### P0-04 · Corregir el crash al borrar el último proyecto + Error Boundary
- **Problema:** E-01, E-38, E-39.
- **Archivos:** `App.tsx`, `index.tsx` (y un nuevo `ErrorBoundary.tsx`).
- **Solución:** si tras borrar quedan 0 proyectos, crear uno nuevo con `createNewProject`. Proteger `project` frente a `undefined`. Sacar `setActiveProjectId` del updater. Error Boundary con mensaje traducido y botón "recargar".
- **Dependencias:** ninguna · **Dificultad:** S · **Prioridad:** P0.
- **Terminado cuando:** borrar todos los proyectos deja un proyecto vacío utilizable y sin errores en consola.
- **Verificación:** test e2e (Playwright) que borra todos los proyectos.

### P0-05 · Texto seguro en `drawtext`
- **Problema:** S-03 (inyección de filtros) y E-07.
- **Archivos:** `ffmpegService.ts`, `exportService.ts`, `routes/export.ts`, `server/assets/fonts/` (nuevo).
- **Solución:** escribir cada título en un `.txt` temporal del job y usar `drawtext=textfile='…':expansion=none:fontfile='…'` con una fuente empaquetada (licencia libre, por ejemplo Inter u Oswald). Validar en el servidor: título ≤ 64 caracteres, sin caracteres de control salvo `\n`.
- **Dependencias:** P0-01 · **Dificultad:** M · **Prioridad:** P0.
- **Terminado cuando:** títulos con `'`, `"`, `%`, `:`, `,`, `\n` y emojis exportan correctamente y se ven igual que el texto introducido.
- **Verificación:** test de integración que exporta un clip de 1 s con esos títulos y extrae un fotograma (`ffmpeg -frames:v 1`) para revisarlo.

### P0-06 · Reducir la superficie de red y añadir límites básicos
- **Problema:** S-06 y S-07 (parcial).
- **Archivos:** `server/src/index.ts`, `vite.config.ts`, `routes/upload.ts`, `downloadService.ts`.
- **Solución:** `app.listen(PORT, HOST)` con `HOST=127.0.0.1` por defecto. Quitar `host: '0.0.0.0'` y añadir `strictPort: true` en Vite. Exigir la cabecera `X-Requested-With` (fuerza el preflight CORS). `express-rate-limit`. yt-dlp con `--max-filesize 300M --match-filter "duration<=900"`. Multer con `diskStorage` (E-19).
- **Dependencias:** P0-01 · **Dificultad:** M · **Prioridad:** P0.
- **Terminado cuando:** el servidor no responde desde otra IP de la LAN; un upload multipart sin la cabecera desde otro origen recibe 403.
- **Verificación:** `curl` desde otra máquina o con `--interface`; test de integración.
- **Nota:** cambiar `vite.config.ts` y añadir dependencias requiere tu autorización (CLAUDE.md §2).

### P0-07 · Retirar los datos personales del código
- **Problema:** S-10.
- **Archivos:** `App.tsx` (`DEFAULT_PROFILE`), placeholders de `ProfileView.tsx`.
- **Solución:** perfil por defecto genérico, sin correo ni nombre real.
- **Dependencias:** ninguna · **Dificultad:** S · **Prioridad:** P0.
- **Terminado cuando:** grep del correo y del nombre en el bundle de producción no da resultados.
- **Verificación:** `vite build` + grep.

### P0-08 · Actualizar dependencias vulnerables del servidor
- **Problema:** S-13.
- **Archivos:** `server/package.json`, `server/package-lock.json`.
- **Solución:** `npm audit fix` (sin `--force`). Sustituir `uuid` por `crypto.randomUUID()`. Evaluar actualizar nodemon.
- **Dependencias:** ninguna · **Dificultad:** S · **Prioridad:** P0.
- **Terminado cuando:** `npm audit --omit=dev` no da vulnerabilidades altas ni críticas.
- **Verificación:** `npm audit` + arranque y tests.

---

## Estado de ejecución de P0 (2026-11-01)

Implementado tras tu autorización. No hay nada commiteado. El detalle por archivo está en `PLAN.md`, sección "Auditoría — Prioridad 0". Todo lo de abajo se probó contra el servidor local (`127.0.0.1:3001`) y Vite (`localhost:3000`). No hay tests automatizados: P3-01a sigue pendiente.

| Tarea | Estado | Verificación realizada |
|---|---|---|
| P0-01 | ✅ | `grep` sin `exec(`/`execSync(` en `server/src`. Una subida con nombre `clip "$(echo X)" & echo INJECTED; it's \`ls\`.mp4` devolvió 200 y se guardó saneado; no se ejecutó nada |
| P0-02 | ✅ | `/api/exports/...` da 404. `GET /api/export/<id>/file` con traversal da 400 y con un UUID desconocido da 404 |
| P0-03 | ✅ | 400 con: `url` en lugar de `assetId`, `..\`, `../`, ruta absoluta. Un proyecto antiguo (solo `url` `/api/files/...`) exporta bien desde la UI gracias a la migración en `getClipAssetId` |
| P0-04 | ✅ | En el navegador: borrar el último proyecto crea "NEW VIRAL RANKING" sin errores; `localStorage` `[]` carga los proyectos de ejemplo; datos corruptos muestran el Error Boundary |
| P0-05 | ✅ | Export real (2 clips, 360×640, 5,02 s) con títulos que llevan `'`, `"`, `%`, `:`, `,`, `;`, `[]`, `$()`, `` ` ``, `\` y `\n`; en los fotogramas el texto aparece literal. 400 con `titleStroke`/posiciones en string, caracteres de control o título de más de 100 caracteres. **Desviación:** se usa una fuente del sistema o `FONT_FILE`, no una fuente empaquetada (descargarla necesita tu permiso) |
| P0-06 | 🟡 | El servidor escucha solo en `127.0.0.1`. Un POST sin `X-Requested-With: viral-ranker` da 403. Preflight desde otro origen: ACAO fijado a `localhost:3000`. Archivo no-vídeo da 400 y `storage/tmp` queda vacío. Host falso `youtube.com.evil.example` y `ftp://` dan 400. `/api/health` responde en unos 0,2 s durante una descarga, así que no bloquea. **Falta:** `express-rate-limit` (dependencia nueva, pendiente de tu aprobación) |
| P0-07 | ✅ | `vite build` + grep del nombre y el correo en el bundle: 0 coincidencias |
| P0-08 | ✅ | `npm audit --omit=dev`: 0 altas/críticas. Quedan 2 moderadas de `qs`, ligadas a express 4.22.2; `npm audit fix` no las resuelve |

### Hallazgos nuevos durante P0

- **E-41 — `drawtext` sin fuente se cuelga en el ffmpeg actual (confirmado por ejecución).** ffmpeg 9.0.2 en Windows sin fontconfig termina con -1073741819. Pasa también con el comando original vía `cmd.exe`, así que **las exportaciones con título ya fallaban en esta máquina antes de P0**. Mitigado pasando siempre `fontfile`.
- **E-42 — Falta `@types/react` (confirmado).** React queda sin tipos, por lo que el "0 errores" de `tsc` en la raíz (ver 05) no comprueba props ni hooks. `ErrorBoundary.tsx` necesita `declare props` por este motivo.
- **E-43 — yt-dlp no descarga de YouTube sin runtime JS (confirmado por ejecución).** yt-dlp 2026.10.21 pide `deno` para el challenge de YouTube; la API devuelve 400 con ese mensaje. Es del entorno, no del código. No se probaron TikTok ni Instagram.

---

## PRIORIDAD 1 — ALTA (funcionalidades principales que no funcionan)

### P1-01 · Mostrar los errores de exportación
- **Problema:** E-02.
- **Archivos:** `App.tsx`, `translations.ts`.
- **Solución:** renderizar `exportError` (banner o modal ES/EN con "Reintentar"). Validar antes de enviar (clips sin video, `start ≥ end`) con mensajes claros. Mostrar `currentStep`.
- **Dependencias:** ninguna · **Dificultad:** S · **Prioridad:** P1.
- **Terminado cuando:** cada causa de fallo muestra un mensaje legible.
- **Verificación:** e2e exportando un proyecto con un clip sin video.

### P1-07 · Configuración por entorno y build del servidor
- **Problema:** E-08, E-14, E-15.
- **Archivos:** `App.tsx` y un nuevo `services/apiClient.ts`, `vite.config.ts` (proxy `/api`), `server/package.json` (`prestart`), `.gitignore`, `server/.env.example`.
- **Solución:** cliente API centralizado (cumple la regla de CLAUDE.md "servicios en `services/`") con base `import.meta.env.VITE_API_URL ?? ''` y proxy de Vite `/api → :3001`. Guardar **rutas relativas o assetId** en los proyectos y migrar los existentes. `prestart: npm run build`. Borrar `server/dist`, que ya está ignorado.
- **Dependencias:** P0-03 · **Dificultad:** M · **Prioridad:** P1.
- **Terminado cuando:** `grep localhost:3001` en `src` no da resultados y `npm start` sirve `/api/export`.
- **Verificación:** `npm run build && npm start` en `server/`, e2e completo.

### P1-05 · Entrada de URL robusta
- **Problema:** E-05.
- **Archivos:** `App.tsx` (`ClipCard`).
- **Solución:** estado local `sourceUrl` separado de `clip.url`. Descarga con un botón, `onPaste` o Enter. Mostrar la URL de origen y no la URL servida.
- **Dependencias:** P1-07 · **Dificultad:** S · **Prioridad:** P1.
- **Terminado cuando:** teclear una URL no lanza peticiones hasta confirmar.
- **Verificación:** e2e con interceptación de red.

### P1-06 · Descargas asíncronas y de mejor calidad
- **Problema:** E-16 y la calidad de 360p.
- **Archivos:** `downloadService.ts`, `routes/download.ts`.
- **Solución:** `runProcess` asíncrono. Formato `bv*[ext=mp4][height<=1920]+ba[ext=m4a]/b[ext=mp4]` con `--merge-output-format mp4`. Restringir extractores (S-08). Opcional: devolver un job y hacer polling, igual que en el export.
- **Dependencias:** P0-01 · **Dificultad:** M · **Prioridad:** P1.
- **Terminado cuando:** durante una descarga, `/api/health` responde en menos de 100 ms y un vídeo de YouTube se descarga a ≥ 720p cuando existe.
- **Verificación:** `curl` concurrente y `ffprobe` del archivo.

### P1-08 · Estado del clip activo y operaciones asíncronas
- **Problema:** E-09, E-11.
- **Archivos:** `App.tsx`.
- **Solución:** reiniciar `activeClipId` cuando cambia `project.id`. Usar `setProjects(prev => …)` funcional por `projectId` y `clipId` en descarga y subida. Estados de carga y error por clip (`Record`).
- **Dependencias:** ninguna · **Dificultad:** S · **Prioridad:** P1.
- **Terminado cuando:** editar otros clips durante una descarga conserva los cambios, y el arrastre del título del clip funciona tras cambiar de proyecto.
- **Verificación:** test e2e con una descarga simulada (mock de red con retardo).

### P1-09 · Rangos coherentes y reordenación
- **Problema:** E-12.
- **Archivos:** `App.tsx`, `types.ts`.
- **Solución:** `rank` derivado del índice (o renumerado tras cada cambio). Botones ↑/↓ (iconos ya importados) o arrastrar para reordenar.
- **Dependencias:** ninguna · **Dificultad:** S · **Prioridad:** P1.
- **Terminado cuando:** tras añadir, borrar y reordenar, los rangos son siempre 1..N sin duplicados.
- **Verificación:** test unitario de la función de renumeración y e2e.

### P1-10 · Preview fiel al trim
- **Problema:** E-10, E-13, E-28, E-30.
- **Archivos:** `App.tsx`, `TrimTimeline.tsx`.
- **Solución:** `onTimeUpdate`: si `t ≥ endTime`, volver a `startTime`. Barra de progreso con estado actualizado por `timeupdate`. Inputs limitados a `[0, duration]` con `start < end`. Reiniciar `startTime` al cambiar la fuente.
- **Dependencias:** ninguna · **Dificultad:** S · **Prioridad:** P1.
- **Terminado cuando:** la preview reproduce solo el rango y no se puede guardar un trim inválido.
- **Verificación:** e2e y test unitario de la validación.

### P1-02 · Coordenadas normalizadas
- **Problema:** E-04.
- **Archivos:** `types.ts`, `App.tsx` (arrastre y render), `exportService.ts`, migración de `localStorage`.
- **Solución:** guardar `{fx, fy}` ∈ [0,1] (centro del texto relativo al lienzo). En la preview, `left: fx*100%`, `top: fy*100%` con `translate(-50%,-50%)`. En ffmpeg, `x=W*fx-text_w/2`, `y=H*fy-text_h/2`. El tamaño de fuente también relativo a la altura del lienzo. Migrar los valores en px usando el tamaño de referencia.
- **Dependencias:** P0-05, P1-03 · **Dificultad:** M · **Prioridad:** P1.
- **Terminado cuando:** en preview y export (mismo fotograma), la posición del título coincide con un margen de ±2 % del lienzo, con cualquier tamaño de ventana.
- **Verificación:** test visual: fotograma exportado frente a captura de la preview en 3 viewports.

### P1-03 · Pipeline de export normalizado 1080×1920
- **Problema:** E-03, E-06, E-18.
- **Archivos:** `ffmpegService.ts`, `exportService.ts`.
- **Solución:** una sola pasada por clip: `-ss/-to`, `scale+pad` (o crop) a 1080×1920 con el color de `background`, `fps=30`, `format=yuv420p`, audio `aac 48 kHz` estéreo (pista silenciosa con `anullsrc` si no hay audio), y `drawtext` de P0-05. Concat de segmentos ya homogéneos. Progreso real leyendo `-progress pipe:1`. Timeout por proceso.
- **Dependencias:** P0-01, P0-05 · **Dificultad:** L · **Prioridad:** P1.
- **Terminado cuando:** exportar YouTube + TikTok + Instagram mezclados produce un MP4 de 1080×1920, de duración igual a la suma de los trims (±0,1 s), con audio continuo.
- **Verificación:** `ffprobe` automatizado en un test de integración con 3 clips de prueba cortos (fixtures).

### P1-04 🔶 · Fidelidad visual del export
- **Problema:** el export ignora el fondo, el layout, la lista de rankings y los estilos.
- **Archivos:** `exportService.ts`, `ffmpegService.ts`, `App.tsx` (payload), `types.ts`, y quizá un módulo compartido de estilos.
- **Solución:** según tu decisión, dos caminos:
  - **(a)** Traducir cada preset a parámetros de `drawtext` y `drawbox` (color, borde, caja, sombra), con layout `videoHeight` mediante `scale+pad` y la lista lateral como varios `drawtext` con `enable='between(t,…)'`.
  - **(b)** Renderizar en el navegador las capas de texto como PNG transparentes (canvas) y superponerlas con `overlay`. Esta opción da máxima fidelidad con la preview.
- **Dependencias:** P1-02, P1-03 · **Dificultad:** L–XL · **Prioridad:** P1.
- **Terminado cuando:** existe una lista acordada de elementos y cada uno aparece en el export.
- **Verificación:** comparación visual por fotograma para cada preset.

---

## PRIORIDAD 2 — MEDIA (funcionalidades esenciales incompletas)

| ID | Descripción | Problema | Archivos | Solución | Dep. | Dif. | Terminado cuando | Verificación |
|---|---|---|---|---|---|---|---|---|
| P2-01 🔶 | Cola de jobs y persistencia | E-17 | `exportService.ts`, nuevo `queue.ts` | Cola con concurrencia (librería a decidir), jobs persistidos en JSON o en la BD, cancelación (`DELETE /api/export/:id`) | P0-01 | M | 5 exports simultáneos se procesan de 1 en 1 o de 2 en 2; un job sobrevive a un reinicio o se marca como fallido de forma explícita | Test de integración |
| P2-02 | Limpieza de almacenamiento | E-31 | `server/src/services/storageService.ts` (nuevo) | Al arrancar: borrar `processing/*` y los exports sin job. Recolector periódico de uploads con más de N días sin uso (endpoint `touch` desde el cliente al abrir un proyecto) | P0-03 | M | El disco no crece de forma indefinida en una prueba de carga | Test con relojes simulados |
| P2-03 🔶 | Barra de formato y Quick Export | E-25 | `App.tsx` | Implementar las acciones decididas (deshacer/rehacer con historial, negrita/cursiva → preset) u ocultarlas | — | M | Ningún botón visible queda sin acción | Auditoría e2e de handlers |
| P2-04 | Perfil honesto y conectado | E-26, E-27, E-24 | `App.tsx`, `ProfileView.tsx` | Métricas calculadas (proyectos y exports reales) o eliminadas. `defaultCaptionStyle` y `autoUppercase` aplicados en `createNewProject` y en el render. Corregir el `className` | — | S | No queda ningún número fijo | Revisión y e2e |
| P2-05 🔶 | IA de rankings vía backend | S-11 | `server/src/routes/ai.ts`, `server/src/services/geminiService.ts`, `services/apiClient.ts`, `vite.config.ts` | Mover Gemini al servidor (clave en `server/.env`), con rate limit. UI "Generar con IA" que cree clips con los títulos. Quitar `define` de la clave en Vite | P1-07 | M | La clave no aparece en el bundle y la UI genera N títulos | Grep del bundle y test con el SDK simulado |
| P2-06 | Datos de ejemplo y validaciones | E-22, E-23, E-29 | `App.tsx` | Proyecto demo sin un video externo roto, título ≤ 32. Si `duration = 0`, mostrar error y no fijar el trim | — | S | El demo carga sin errores de media | e2e |
| P2-07 | Soporte táctil | 08 §4 | `App.tsx`, `TrimTimeline.tsx` | Pointer Events (`onPointerDown` y `setPointerCapture`) en el arrastre y en los handles | — | S | Arrastre y trim funcionan en emulación táctil | e2e con `hasTouch` |
| P2-08 🔶 | Autenticación y persistencia en el servidor (si es multiusuario) | 06 §1 | Nuevo backend de datos | BD (Postgres o Supabase) con users, projects, clips, assets y export_jobs, auth, autorización por propietario y almacenamiento de objetos | Decisión | XL | Cada usuario solo ve y procesa lo suyo | Tests de autorización |
| P2-09 🔶 | Aviso legal | S-14 | UI y documentación | Aviso de derechos al pegar enlaces, términos de uso y política de privacidad | Decisión | S | Aviso visible y aceptado | Revisión |

---

## PRIORIDAD 3 — MEJORAS TÉCNICAS

| ID | Descripción | Problema | Archivos | Solución | Dep. | Dif. | Terminado cuando | Verificación |
|---|---|---|---|---|---|---|---|---|
| **P3-01a** | **Tests de humo antes de tocar nada** | Sin red de seguridad | `vitest`, `supertest`, `@playwright/test` (nuevas devDeps, requieren autorización) | Tests de caracterización: health, validaciones 400, render de Home y Editor, crear clip | — | M | `npm test` pasa en verde sobre el código actual | CI local |
| P3-01b | Suite completa | 09 §6 | `tests/` | Unitarios (renumeración, validación de trim, mapeo de coordenadas, `detectPlatform`), integración del API con fixtures de video cortos, e2e del flujo principal. Sustituir los `test-*.js` | P3-01a | L | Cobertura de los flujos críticos | CI |
| P3-02 | Linter y TS estricto | 05 (any, imports sin uso) | `eslint.config.js`, `tsconfig.json` | ESLint (react-hooks, no-unused-vars) y Prettier. `strict: true` en la raíz con correcciones graduales | P3-01a | M | `npm run lint` y `tsc` sin errores | CI |
| P3-03 | Separar `App.tsx` | Monolito de 1.334 líneas | `components/…`, `hooks/…` | Extraer `ClipCard`, `EditorView`, `ProjectsView`, `HomeView`, `PreviewCanvas`, `useProjects` y `useExport`, sin cambiar el comportamiento | P3-01a | L | `App.tsx` < 300 líneas, tests verdes | Tests |
| P3-04 | Limpieza de código | 02 §7 | Varios | Quitar código muerto, unificar `getVideoDuration`, quitar los logs de debug (logger con niveles), unificar `STYLE_PRESETS` | P3-02 | S | Sin imports ni funciones sin uso (ESLint) | Lint |
| P3-05 | Tailwind compilado | B-8, animaciones | `index.html`, `tailwind.config`, `postcss`, `index.css` | Tailwind vía PostCSS más `tailwindcss-animate`. Quitar el CDN, el importmap y el `/index.css` inexistente. Definir las clases `scrollbar-*` | P3-01a | M | Sin aviso en consola; las animaciones `animate-in` funcionan | Navegador |
| P3-06 | Documentación al día | E-35 | `CLAUDE.md`, `PLAN.md`, `README.md`, `server/README.md` | Reflejar el estado real, los endpoints, los requisitos (ffmpeg y yt-dlp), y reabrir la Fase 6 | — | S | La documentación coincide con el código | Revisión |
| P3-07 | Rutas de almacenamiento unificadas | 03 §5 | `server/src/config.ts` (nuevo) | `STORAGE_DIR` por env, una sola fuente de verdad | P0-03 | S | Arranca igual desde cualquier directorio | Test |
| P3-08 | `localStorage` robusto | E-32, 06 §1 | `App.tsx` y un `services/storage.ts` | Versión de esquema más migraciones. Validar al leer. Throttle o guardado al soltar en el arrastre | P1-02 | S | Proyectos antiguos migran y no hay escrituras por cada `mousemove` | Test unitario |
| P3-09 🔶 | Despliegue | B-6, B-7 | `Dockerfile`, `docker-compose.yml`, CI | Imagen con Node, ffmpeg, yt-dlp y la fuente; frontend estático servido por Express o un CDN; healthcheck; CI con lint, tests y build | P0-*, P1-07 | M | `docker compose up` levanta todo y el e2e pasa contra el contenedor | CI |
| P3-10 | Higiene del repositorio | E-36, 02 §7 | Raíz | Commitear solo tras P0-02. Elegir un lockfile (npm o bun). Mover o borrar `debug-page.png`, `frontend.log` y `test-*.js` | P0-02 | S | `git status` limpio y un solo lockfile | Revisión |

---

## PRIORIDAD 4 — OPTIMIZACIONES

| ID | Descripción | Archivos | Solución | Dif. | Terminado cuando |
|---|---|---|---|---|---|
| P4-01 | Accesibilidad | `App.tsx`, `ProfileView.tsx`, `TrimTimeline.tsx` | `aria-label` en los 16 botones de icono, `role="switch"` y `aria-checked`, foco visible, labels, `lang` dinámico, contraste AA, `prefers-reduced-motion`, handles del trim operables con teclado | M | Lighthouse a11y ≥ 90 |
| P4-02 | i18n completa | `translations.ts` y componentes | Traducir los textos de 08 §14 y los mensajes del servidor (códigos de error → traducción en el cliente) | S | Ningún texto fijo en un solo idioma |
| P4-03 | Rendimiento de medios | `App.tsx` | `preload="metadata"`, miniaturas JPG generadas en el servidor (`Clip.thumbnail`), memorizar `ClipCard` | S | Al abrir un proyecto de 10 clips no se descargan los videos completos |
| P4-04 | Router | `index.tsx`, `App.tsx` | Rutas `/projects/:id` (react-router o un router ligero) | M | El botón atrás y los deep links funcionan |
| P4-05 | UX del export | `App.tsx` | Mostrar el paso actual, permitir cancelar, nombre de archivo correcto (`Content-Disposition` con el título) | S | El archivo se descarga con el nombre del proyecto |
| P4-06 | Preview más grande en pantallas medianas | `App.tsx` | Rediseñar el layout del editor (preview ≥ 320 px de ancho a ≥ 1024 px) | M | La preview es usable a 1024×768 |
| P4-07 | SEO y metadatos | `index.html` | `meta description`, Open Graph, favicon | S | Metadatos presentes |
| P4-08 | Deuda cosmética del PLAN | `App.tsx` | Reposicionar el panel de control de la preview (nota de la Fase 4) | S | Aprobado visualmente |

---

## Resumen de esfuerzo (orientativo)

| Prioridad | Tareas | Esfuerzo aproximado |
|---|---|---|
| P0 | 8 | 4–6 días |
| P1 | 10 | 8–14 días (P1-04 depende de tu decisión) |
| P2 | 9 | 5–8 días, sin contar P2-08 (XL) |
| P3 | 11 | 7–10 días |
| P4 | 8 | 4–6 días |

Son estimaciones para una persona con experiencia en el stack. Sirven para ordenar el trabajo, no como compromiso.
