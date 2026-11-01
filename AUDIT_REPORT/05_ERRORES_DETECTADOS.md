# 05 — Errores detectados

## Leyenda

**Tipo de evidencia**
- **CE** = Confirmado por ejecución en esta auditoría (comando, navegador o `ffprobe`).
- **CC** = Confirmado por inspección de código (el comportamiento se deduce sin ambigüedad del código, pero no se ejecutó).
- **PT** = Potencial (depende del entorno, de los datos o del SO; probabilidad indicada).

**Gravedad:** Crítica · Alta · Media · Baja.

Las vulnerabilidades de seguridad (S-xx) se detallan en `07_AUDITORIA_DE_SEGURIDAD.md`. Aquí solo se listan en la tabla resumen.

## Resumen

| ID | Problema | Archivo | Gravedad | Evidencia |
|---|---|---|---|---|
| S-01…S-05 | Inyección de comandos, path traversal y SSRF en el backend | `server/src/**` | Crítica | CE (S-04) / CC |
| E-01 | Pantalla blanca al eliminar el último proyecto | `App.tsx:199-209, 287-297` | Crítica | CC |
| E-02 | Los errores de exportación nunca se muestran | `App.tsx:261, 481, 597` | Alta | CC |
| E-03 | El export no se normaliza a 1080×1920 | `ffmpegService.ts:37-47, 95-104` | Alta | CE |
| E-04 | Posiciones de títulos mal convertidas al video | `exportService.ts:144-151` | Alta | CE + CC |
| E-05 | La descarga se dispara en cada pulsación de tecla | `App.tsx:1305` | Alta | CC |
| E-06 | Concat `-c copy` de clips heterogéneos | `ffmpegService.ts:120-167` | Alta | PT (alta) |
| E-07 | Títulos con salto de línea, `'` o `%` rompen el export | `ffmpegService.ts:77-88` | Alta | CC / PT |
| E-08 | `npm start` ejecuta un build obsoleto sin exportación | `server/dist/`, `server/package.json` | Alta | CE |
| E-14 | URL del backend fija en el código (7 veces) | `App.tsx` | Alta | CE |
| E-16 | `execSync` bloquea todo el servidor durante descargas | `downloadService.ts:70`, `videoService.ts:50,70` | Alta | CC |
| E-09 | `activeClipId` no se reinicia al cambiar de proyecto | `App.tsx:303-307` | Media | CC |
| E-10 | La preview ignora el trim al reproducir | `App.tsx:315-327, 1204` | Media | CC |
| E-11 | Cierres obsoletos sobrescriben cambios tras la descarga o subida | `App.tsx:346-469` | Media | CC |
| E-12 | Rangos duplicados o con huecos; sin reordenar | `App.tsx:1139-1165` | Media | CC |
| E-13 | Inputs de trim sin validación | `App.tsx:1316, 1320` | Media | CC |
| E-15 | El puerto de Vite y el origen CORS divergen | `vite.config.ts`, `server/src/index.ts:16-24` | Media | CE |
| E-17 | Jobs en memoria y exports concurrentes ilimitados | `exportService.ts:56`, `routes/export.ts:77` | Media | CC |
| E-19 | Upload de hasta 200 MB en RAM | `routes/upload.ts:7-12` | Media | CC |
| E-20 | Stream de archivo sin manejador de error | `routes/files.ts:46-47, 56-57` | Media | PT |
| E-25 | 12 controles visibles sin funcionalidad | `App.tsx:876, 1022-1035` | Media | CC |
| E-26 | Métricas ficticias presentadas como reales | `App.tsx:171-176`, `ProfileView.tsx:250` | Media | CC |
| E-27 | Preferencias del perfil sin efecto | `ProfileView.tsx`, `App.tsx` | Media | CC |
| E-31 | Almacenamiento sin limpieza (~824 MB) | `server/storage` | Media | CE |
| E-35 | Documentación y PLAN desalineados con el código | `CLAUDE.md`, `PLAN.md`, READMEs | Media | CC |
| E-36 | Cambios sin commitear incluyen una vulnerabilidad | working tree | Media | CE |
| E-38 | No hay Error Boundary | `index.tsx`, `App.tsx` | Media | CC |
| E-18 | El progreso del export es por pasos, no real | `exportService.ts:141, 200, 209` | Baja | CC |
| E-21 | Range `bytes=-N` no soportado | `routes/files.ts:28-30` | Baja | CC |
| E-22 | El video del proyecto de ejemplo devuelve 403 | `App.tsx:150` | Baja | CE |
| E-23 | El título de ejemplo excede el máximo de 32 | `App.tsx:149` | Baja | CC |
| E-24 | `className` sin interpolar en ProfileView | `ProfileView.tsx:432` | Baja | CC |
| E-28 | La barra de progreso de reproducción no avanza | `App.tsx:1241` | Baja | CC |
| E-29 | Duración 0 genera un trim inválido | `App.tsx:386, 452` | Baja | PT |
| E-30 | `startTime` no se reinicia al cambiar la fuente | `App.tsx:386, 452` | Baja | CC |
| E-32 | Escritura completa en `localStorage` en cada `mousemove` | `App.tsx:192-194, 647, 686` | Baja | CC |
| E-33 | `/index.css` inexistente | `index.html:45` | Baja | CE |
| E-34 | `test-phase1.js` no puede ejecutarse | `test-phase1.js` | Baja | CC |
| E-37 | El nombre del archivo descargado se ignora | `App.tsx:563-568` | Baja | CC |
| E-39 | Efecto secundario dentro del updater de `setProjects` | `App.tsx:201-207` | Baja | CC |
| E-40 | Código muerto y duplicado | varios | Baja | CC |

---

## Detalle

### E-01 — Pantalla blanca al eliminar el último proyecto
- **Archivo:** `App.tsx:199-209` (`handleDeleteProject`), `App.tsx:287-297`.
- **Causa:** al filtrar, `projects` queda `[]`. Entonces `project = projects.find(...) || projects[0]` es `undefined`, y en el mismo render `project.clips.length` (`App.tsx:293`) lanza `TypeError`. No hay Error Boundary.
- **Consecuencia:** React desmonta toda la app y queda la pantalla en blanco. Como el render falla antes del commit, el `useEffect` que guarda en `localStorage` no llega a ejecutarse: al recargar, el proyecto "borrado" reaparece. El usuario ve una app rota y un borrado que no funciona.
- **Gravedad:** Crítica (crash total, acción común).
- **Evidencia:** CC. La prueba en navegador fue bloqueada por permisos.
- **Solución:** impedir borrar el último proyecto o crear uno vacío al quedar 0, y proteger `project` contra `undefined`. Añadir un Error Boundary.

### E-02 — Los errores de exportación nunca se muestran
- **Archivo:** `App.tsx:261` (declaración), `481` y `597` (`setExportError`). No hay ninguna lectura de `exportError` en el JSX.
- **Causa:** el estado se guarda pero no se renderiza.
- **Consecuencia:** exportar sin clips, con un clip sin video, con `start ≥ end`, con el video de ejemplo (403) o con un fallo de ffmpeg cierra el overlay **sin decir nada**. El criterio de la Fase 6 "el usuario recibe un mensaje de error claro" **no se cumple**.
- **Gravedad:** Alta. **Evidencia:** CC (grep: `exportError` solo aparece en la línea 261).
- **Solución:** banner o modal de error traducido (ES/EN) con un botón para reintentar.

### E-03 — El export no se normaliza a 1080×1920
- **Archivo:** `ffmpegService.ts:37-47` (trim) y `95-104` (overlay). No hay filtros `scale`/`pad`/`fps`.
- **Causa:** se re-codifica conservando la resolución de origen.
- **Consecuencia:** los 4 exports existentes miden **360×640** (`ffprobe`). El PLAN afirma "Resolución: 1080x1920".
- **Gravedad:** Alta. **Evidencia:** CE.
- **Solución:** `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=<background>,fps=30,format=yuv420p`, más audio a 48 kHz estéreo (y pista silenciosa si falta).

### E-04 — Posiciones de títulos mal convertidas al video
- **Archivo:** `exportService.ts:144-151`. Origen en `App.tsx:625-698` y `735`, `1195`.
- **Causa:** son cuatro errores combinados:
  1. La preview **no mide 540 px**. Medido en el navegador: 160 px de ancho interior con un viewport de 1024×768 y 181 px en móvil (375×812). Su tamaño depende del viewport y las posiciones se guardan en píxeles absolutos de ese tamaño.
  2. El frontend guarda un **desplazamiento desde el centro** (`translate`) del **centro del texto**, mientras que `drawtext x/y` es la **esquina superior izquierda** del texto, medida desde la esquina del video. Con `x = 0` (centrado) el texto se dibuja pegado al borde izquierdo.
  3. Y del título principal: `(y/540)*1920 + 960`; Y del título del clip: `(y/540)*1920` **sin** el +960. Son inconsistentes entre sí.
  4. Se supone una salida de 1080 de ancho que no existe (E-03).
- **Consecuencia:** los títulos salen descolocados o fuera de cuadro. El fotograma extraído de un export existente muestra el título del clip cortado en el borde izquierdo.
- **Gravedad:** Alta. **Evidencia:** CE (fotograma y medición) + CC.
- **Solución:** guardar posiciones **normalizadas** (fracción 0–1 del lienzo) y en el backend usar `x=W*fx-text_w/2`, `y=H*fy-text_h/2`. Migrar los proyectos existentes.

### E-05 — La descarga se dispara en cada pulsación de tecla
- **Archivo:** `App.tsx:1305`.
- **Causa:** `onChange` llama a `onDownloadUrl` cada vez que el texto empieza por `http://` o `https://`.
- **Consecuencia:** al **teclear** una URL, la primera petición sale con `"http://"` (error) y el input se deshabilita durante la petición. Editar la URL ya descargada (`http://localhost:3001/...`) dispara una nueva descarga que falla con "Unsupported platform". Pegar la URL completa sí funciona.
- **Gravedad:** Alta. **Evidencia:** CC.
- **Solución:** disparar la descarga con `onPaste`, `onBlur` o un botón "Descargar", con debounce, y separar el campo "URL de origen" de la URL del archivo servido.

### E-06 — Concat `-c copy` de clips heterogéneos
- **Archivo:** `ffmpegService.ts:120-167`.
- **Causa:** el demuxer `concat` con `-c copy` exige que todos los segmentos tengan el mismo códec, resolución, fps, sample rate y orden de pistas.
- **Consecuencia:** en los uploads reales hay 360×640 a 48 kHz (YouTube) y 720×1280 a 44,1 kHz con la pista de audio primero (TikTok). Mezclarlos produce un video con cambio de resolución a mitad, audio desincronizado o errores. Los 4 exports existentes se hicieron con fuentes homogéneas, así que el caso no está probado.
- **Gravedad:** Alta. **Evidencia:** PT con probabilidad alta (las diferencias en los uploads están verificadas con `ffprobe`).
- **Solución:** normalizar cada segmento (E-03) antes de concatenar, o usar el filtro `concat` re-codificando.

### E-07 — Títulos con salto de línea, `'` o `%` rompen el export
- **Archivo:** `ffmpegService.ts:77-88`.
- **Causa:**
  - `'` se "escapa" como `\'` **dentro** de un texto entre comillas simples de ffmpeg. En la sintaxis de filtros de ffmpeg una comilla simple no se puede escapar dentro de comillas simples, así que "Bro's internet" rompe el filtro (CC).
  - `%` activa la expansión de texto de `drawtext` (`%{...}`) (CC).
  - El título principal admite saltos de línea (textarea; el proyecto de ejemplo tiene uno). En `cmd.exe`, un salto de línea dentro del comando corta la orden (PT en Windows con probabilidad alta; en Linux el riesgo es de seguridad, ver S-03).
  - No se especifica `fontfile`: depende de fontconfig y de las fuentes del sistema (PT).
- **Gravedad:** Alta. **Solución:** escribir el texto en un archivo temporal y usar `drawtext=textfile=...:expansion=none`, con una fuente empaquetada `fontfile=`.

### E-08 — `npm start` ejecuta un build obsoleto
- **Archivo:** `server/dist/index.js` (no registra `/api/export`), `server/package.json` (`"start": "node dist/index.js"`).
- **Causa:** `dist/` se generó en la Fase 3 en ESM y no se ha recompilado desde el cambio a CommonJS y la Fase 6.
- **Consecuencia:** en un despliegue con `npm start`, la exportación devuelve 404. `server/server.log` muestra además un `EADDRINUSE` (dos instancias a la vez).
- **Gravedad:** Alta. **Evidencia:** CE (lectura de `dist/index.js` y listado de archivos).
- **Solución:** script `prestart: npm run build` o pipeline de build, y no versionar `dist`.

### E-14 — URL del backend fija en el código
- **Archivo:** `App.tsx:357, 384, 418, 450, 525, 550, 564`.
- **Consecuencia:** imposible desplegar sin editar el código. Las URLs absolutas quedan **guardadas** en los proyectos (`clip.url`), así que si cambia el host todos los videos se rompen.
- **Gravedad:** Alta. **Solución:** `VITE_API_URL` y proxy de Vite (`/api`), guardar el **id de archivo** en lugar de la URL y construir la URL al renderizar.

### E-16 — `execSync` bloquea todo el servidor durante descargas
- **Archivo:** `downloadService.ts:70` (timeout 5 min), `videoService.ts:50, 70`.
- **Consecuencia:** mientras yt-dlp descarga, Express no atiende **ninguna** otra petición: health, polling de exports, streaming de videos. Con varios usuarios, el servidor queda inutilizable.
- **Gravedad:** Alta. **Solución:** `spawn`/`execFile` asíncronos y una cola con concurrencia limitada.

### E-09 — `activeClipId` no se reinicia al cambiar de proyecto
- **Archivo:** `App.tsx:303-307`. El efecto solo asigna si `!activeClipId`.
- **Consecuencia:** al pasar del proyecto A al B, `activeClipId` sigue apuntando a un clip de A. La preview cae a `clips[0]`, pero ningún clip se marca como activo, la lista de rankings no resalta nada y **arrastrar el título del clip no hace nada** (`App.tsx:683` no encuentra el id).
- **Gravedad:** Media. **Solución:** reiniciar `activeClipId` al cambiar `project.id`.

### E-10 — La preview ignora el trim al reproducir
- **Archivo:** `App.tsx:315-327` (solo reacciona a cambios de `startTime`/`endTime`) y `1204` (`<video autoPlay loop>`).
- **Consecuencia:** la preview reproduce el archivo completo en bucle. El usuario no ve lo que se va a exportar.
- **Gravedad:** Media. **Solución:** usar `onTimeUpdate` para volver a `startTime` al pasar `endTime`, o media fragments `#t=start,end`.

### E-11 — Cierres obsoletos (stale closures) en descarga y subida
- **Archivo:** `App.tsx:385-388` y `451-454` usan `project.clips` capturado **antes** del `await`. `348/389/397` y `406/455/463` hacen spread de un `downloadErrors`/`uploadErrors` obsoleto.
- **Consecuencia:** si durante una descarga (que puede durar minutos) el usuario edita otro clip, cambia el trim o añade un clip, **esos cambios se pierden** al terminar la descarga. Los errores de un clip pueden borrar los de otro. Además, `downloadingClipId` y `uploadingClipId` admiten un solo clip a la vez.
- **Gravedad:** Media. **Solución:** `setProjects(prev => ...)` funcional por id de proyecto y de clip, y estado de carga por clip (`Record<id, status>`).

### E-12 — Rangos duplicados o con huecos
- **Archivo:** `App.tsx:1140-1141` (`rank = length + 1`), `1161-1165` (borrar sin renumerar).
- **Consecuencia:** con 3 clips, borrar el #1 y añadir otro da rangos 2, 3, 3. El backend ordena por `rank` (`exportService.ts:132`): el orden entre empates es el del array. Los iconos `ArrowUp`/`ArrowDown` están importados, pero **no existe UI para reordenar**.
- **Gravedad:** Media. **Solución:** derivar `rank` del índice, con reordenación (drag o flechas).

### E-13 — Inputs de trim sin validación
- **Archivo:** `App.tsx:1316, 1320`.
- **Consecuencia:** aceptan negativos, `start ≥ end` y valores mayores que la duración. El backend rechaza `start ≥ end`, pero el error no se ve (E-02). Si `end` supera la duración, ffmpeg produce un clip más corto sin avisar.
- **Gravedad:** Media. **Solución:** limitar a `[0, duration]` y exigir `start < end` también en el input.

### E-15 — Puerto de Vite y origen CORS divergen
- **Archivo:** `vite.config.ts` (sin `strictPort`), `server/src/index.ts:16-24` (un único origen exacto).
- **Consecuencia:** `frontend.log` muestra Vite arrancando en **3002** porque 3000 y 3001 estaban ocupados. Desde 3002, todas las llamadas fallan por CORS. Lo mismo ocurre si se abre `http://127.0.0.1:3000` en lugar de `localhost`.
- **Gravedad:** Media. **Solución:** `strictPort: true` y proxy `/api` en Vite (mismo origen).

### E-17 — Jobs en memoria y exports concurrentes ilimitados
- **Archivo:** `exportService.ts:56` (`Map`), `routes/export.ts:77` (`processExportJob` sin cola).
- **Consecuencia:** al reiniciar se pierden los jobs (el polling da 404 → error invisible) y los exports quedan huérfanos. N peticiones simultáneas lanzan N×(2 ffmpeg) en paralelo y saturan la CPU. CLAUDE.md prevé una cola, pero `PLAN.md` nunca la definió.
- **Gravedad:** Media (Alta en producción). **Solución:** cola con concurrencia 1–2. La librería concreta requiere tu decisión (por ejemplo BullMQ con Redis, o una cola en proceso como p-queue).

### E-19 — Upload de hasta 200 MB en RAM
- **Archivo:** `routes/upload.ts:7-12` (`multer.memoryStorage()`).
- **Consecuencia:** 5 subidas simultáneas de 200 MB son 1 GB de RAM. Hay riesgo de OOM.
- **Gravedad:** Media. **Solución:** `diskStorage` a un directorio temporal y validar después.

### E-20 — Stream de archivo sin manejador de error
- **Archivo:** `routes/files.ts:46-47, 56-57`.
- **Consecuencia:** si el archivo se borra o hay un error de lectura durante el streaming, el `ReadStream` emite `error` sin listener, lo que puede **tumbar el proceso** de Node.
- **Gravedad:** Media. **Evidencia:** PT. **Solución:** `stream.on('error', ...)` o `pipeline()`.

### E-25 — Controles visibles sin funcionalidad
Tarjeta "Quick Export" (`App.tsx:876`, `onClick={() => {}}`) y 11 botones de la barra del título (`App.tsx:1022-1035`, `ToolbarButton`/`ToolbarDropdown` sin `onClick`). **Gravedad:** Media (engañan al usuario). **Solución:** implementarlos u ocultarlos.

### E-26 — Métricas ficticias presentadas como reales
`DEFAULT_PROFILE.stats` (`App.tsx:171-176`: 12 clips, 45 generaciones IA, "1.2M" de vistas) y el hito "1.2M / 1.0M" fijo (`ProfileView.tsx:250`). Nunca se actualizan. **Gravedad:** Media. **Solución:** calcularlas a partir de datos reales o eliminarlas.

### E-27 — Preferencias del perfil sin efecto
`defaultPlatform`, `defaultCaptionStyle`, `accentColor` y `autoUppercase` se guardan, pero no se leen fuera de `ProfileView` (grep en `App.tsx`: solo aparecen en `DEFAULT_PROFILE`). **Gravedad:** Media. **Solución:** aplicarlas en `createNewProject` y en el render, u ocultarlas.

### E-31 — Almacenamiento sin limpieza
~824 MB en `storage/uploads` (más de 40 archivos, muchos duplicados de las pruebas) y 4 exports huérfanos (16 MB). Ya está anotado como deuda en `PLAN.md`. **Gravedad:** Media. **Solución:** recolector por antigüedad y por referencias, y limpieza de `exports` y `processing` al arrancar.

### E-35 — Documentación desalineada
- `CLAUDE.md` §1 dice que la descarga y la exportación "están simuladas con mocks (`fetchCleanVideoMP4`)": esa función **ya no existe** y el backend sí existe. También menciona "export/import de proyectos", que tampoco existe.
- `README.md` es la plantilla de AI Studio. `server/README.md` documenta solo `/api/health`.
- `PLAN.md` marca la Fase 6 ✅ con "Verificación: código compilado sin errores; implementación lista para testing", es decir, **sin probar**, y sus criterios 3, 4 y 6 no se cumplen (E-02, E-04). La Fase 5 se "verificó" solo compilando. Esto contradice la regla 2 del propio PLAN.
- **Gravedad:** Media. **Solución:** actualizar los documentos y reabrir la Fase 6 como 🟡.

### E-36 — Cambios sin commitear incluyen una vulnerabilidad
`git status`: 3 archivos modificados. La nueva ruta `/api/exports/:filename` (`server/src/index.ts:34-43`) introduce S-04. **Gravedad:** Media. **Solución:** corregir antes de commitear.

### E-38 — No hay Error Boundary
Cualquier excepción de render (como E-01) deja la pantalla en blanco sin mensaje. **Gravedad:** Media.

### Errores de gravedad baja
- **E-18:** el progreso salta 0→60 por clip, luego 70, 90 y 100. No refleja el avance real de ffmpeg (se podría leer `-progress pipe:1`). La Fase 6 afirma "avance real".
- **E-21:** `bytes=-500` produce `start = NaN` y termina en error 500 (`files.ts:28-30`).
- **E-22:** el video de ejemplo devuelve 403 (`curl HEAD` y `<video>.error.code = 4`). El proyecto demo nace roto.
- **E-23:** el título de ejemplo tiene 36 caracteres, más que el `maxLength=32`.
- **E-24:** en `ProfileView.tsx:432`, el `className` usa comillas dobles, así que `${isDarkMode ? …}` queda como texto literal.
- **E-28:** la barra de progreso de reproducción (`App.tsx:1241`) solo se recalcula al re-renderizar.
- **E-29:** si `ffprobe` falla, `duration = 0`, `endTime = Math.min(0, 5) = 0` y el clip queda con un trim inválido.
- **E-30:** al cambiar la fuente se fija `endTime ≤ 5`, pero `startTime` se mantiene y puede quedar `start ≥ end`.
- **E-32:** cada `mousemove` del arrastre serializa **todos** los proyectos en `localStorage` (síncrono).
- **E-33:** `index.html:45` referencia `/index.css`, que no existe (aviso en `vite build`).
- **E-34:** `test-phase1.js` usa `titleTextarea` y `mobileTextarea` sin declararlas, lo que lanza `ReferenceError`.
- **E-37:** `link.download` se ignora en URLs de otro origen (3000→3001): el archivo se descarga como `<uuid>.mp4`.
- **E-39:** `setActiveProjectId` dentro del updater de `setProjects` (`App.tsx:201-207`): efecto secundario en una función que StrictMode ejecuta dos veces.
- **E-40:** código muerto y duplicado (ver 02 §7). `getVideoDuration` de `ffmpegService.ts:202` además no entrecomilla la ruta (sin uso hoy).

## Errores de compilación, tipos e imports

- `tsc --noEmit` (raíz): **0 errores**, pero el `tsconfig` raíz **no es estricto**, así que la comprobación es débil.
- `tsc --noEmit` (servidor, estricto): **0 errores**.
- `vite build`: **OK**, con un aviso por `/index.css`.
- No hay imports rotos. Sí hay imports **sin uso** (ver 02 §7).
- `any` sin justificar: `ClipCard` (`onUpdate: any, onRemove: any`, `App.tsx:1280`), `catch (err: any)`, `p.id as any` (`ProfileView`), `handleMulterError(err: any …)`. CLAUDE.md §4 lo prohíbe salvo justificación comentada.
