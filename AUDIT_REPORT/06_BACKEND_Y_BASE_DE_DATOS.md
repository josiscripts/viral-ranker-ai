# 06 — Backend y base de datos

## 1. Base de datos

**No existe base de datos.** No hay ORM, esquema, migraciones, consultas, transacciones, integridad referencial, RLS ni Supabase. La persistencia es:

| Dato | Medio | Riesgos |
|---|---|---|
| Proyectos, perfil, preferencias | `localStorage` del navegador | Límite de ~5 MB por origen. Sin versión de esquema: un cambio en `types.ts` puede romper proyectos viejos (`JSON.parse` sin validar, `App.tsx:180-190`). Datos no compartibles entre dispositivos. Se pierden si se borra el navegador |
| Videos | Disco local (`server/storage`) | Sin cuotas ni limpieza. La relación proyecto→archivo existe solo como URL dentro del `localStorage` del cliente: el servidor no sabe qué archivos están en uso |
| Jobs de exportación | `Map` en memoria | Se pierden al reiniciar |

Fuera de alcance según el PLAN ("Base de datos persistente: fuera de alcance en Fase 0"). Para producción multiusuario hará falta: usuarios, proyectos, clips, assets (archivos) y jobs. Esa decisión es tuya (ver 12, P2-08).

## 2. Endpoints

| Método y ruta | Archivo | Validación de entrada | Auth | Estado |
|---|---|---|---|---|
| `GET /api/health` | `routes/health.ts` | — | No | ✔ Verificado (200 `{status:"ok"}`) |
| `POST /api/upload` | `routes/upload.ts` | Campo `video`, extensión `.mp4`, ≤ 200 MB, `ffprobe` | No | Implementado. Vulnerable (S-02). En RAM (E-19). Bloqueante (E-16) |
| `GET /api/files/:filename` | `routes/files.ts` | Rechaza `..`, más comprobación `resolve().startsWith()` | No | ✔ Verificado: el traversal devuelve 400. Soporta Range (sin sufijo, E-21) |
| `POST /api/download` | `routes/download.ts` | `new URL()`, `detectPlatform` con `includes()` | No | ✔ Verificado: URL no soportada → 400. Vulnerable (S-01, S-08). Bloqueante |
| `POST /api/export` | `routes/export.ts` | Campos presentes, ≤ 10 clips, `start < end` | No | ✔ Verificado: cuerpo vacío → 400. Vulnerable (S-03, S-05) |
| `GET /api/export/:jobId` | `routes/export.ts` | — | No | ✔ Verificado: id inexistente → 404 |
| `GET /api/exports/:filename` | `index.ts:34-43` (**sin commitear**) | **Ninguna** | No | ✔ **Path traversal confirmado** (S-04) |

Faltan: middleware de errores global, 404 JSON para rutas desconocidas, límites de tamaño específicos (`express.json()` usa el valor por defecto de 100 kB, que es aceptable), rate limiting, `helmet`, logging estructurado y apagado ordenado (graceful shutdown).

## 3. Servicios del servidor

### `videoService.ts`
- `validateVideoFile`: solo comprueba la extensión y el tamaño.
- `isValidMP4` (líneas 46-64): ejecuta `ffprobe -show_format -show_streams` y comprueba si la salida contiene `mov`, `mp4` **o `format_name`**. Como `format_name` aparece **siempre** en la salida de `-show_format`, cualquier archivo que `ffprobe` pueda abrir (un MP3, una imagen) se acepta como "MP4 válido". La validación es casi nula.
- `saveUploadedVideo`: nombre `<timestamp>_<basename(nombreOriginal)>`. Conserva caracteres del cliente (espacios, comillas en Linux, `$()`), que luego se interpolan en el shell (S-02).
- `getFileStats`: protección de traversal correcta.

### `downloadService.ts`
- `detectPlatform` (líneas 16-35): `hostname.includes('youtube.com')` acepta `youtube.com.atacante.tld` (S-08).
- `downloadVideo`: `execSync('yt-dlp -f best[ext=mp4] -o "<ruta>" "<url>" 2>&1')`, que tiene tres problemas:
  - Inyección (S-01).
  - Bloqueante (E-16).
  - `best[ext=mp4]` en YouTube elige el formato progresivo, que suele ser **360p** (verificado: los `*_youtube.mp4` miden 360×640). Sería mejor `-f "bv*[ext=mp4][height<=1920]+ba[ext=m4a]/b[ext=mp4]" --merge-output-format mp4`.
- La detección de errores busca subcadenas (`'rate'`, `'private'`) en la salida, así que hay falsos positivos posibles. El mensaje genérico expone 100 caracteres de la salida interna de yt-dlp al cliente.
- Sin límite de duración ni tamaño del video descargado: un video de 3 horas se descargaría entero.

### `ffmpegService.ts`
- Todas las órdenes se construyen como **cadena** y se ejecutan con `exec` (shell). Ver S-03.
- Doble re-codificación (trim y después overlay), las dos con `-preset medium`: duplica el tiempo y la pérdida de calidad. Se puede hacer en una sola pasada (`-ss/-to` más `-vf drawtext`).
- `-ss` y `-to` van **después** de `-i`: preciso pero lento (decodifica desde el inicio). Aceptable para clips cortos.
- Concat `-c copy` (E-06). `concat_list.txt` usa comillas simples sin escapar: una ruta con `'` rompe la lista. Hoy las rutas son internas (`jobDir/clip_i_final.mp4`), así que el riesgo es bajo.

### `exportService.ts`
- Ciclo de vida del job: `queued → processing? → completed | error`. El estado `processing` **nunca se asigna** (`updateJobProgress` no cambia `status`).
- Mapeo de coordenadas incorrecto (E-04).
- `clip.url` del cliente → `ffmpeg -i` sin restricción (S-05). Si no empieza por `http`, se hace `path.join(STORAGE_BASE, clip.url)`, lo que permite rutas relativas a cualquier archivo local.
- Colores y fuentes fijos (`'#FFFFFF'`, `fontsize` 40/32).
- Limpieza cada 60 s de los jobs con más de 1 h. Correcta mientras el proceso vive. No limpia `uploads`.
- `console.log` de debug abundantes (17), incluida la ruta de cada archivo.

## 4. Procesamiento y concurrencia

| Aspecto | Estado |
|---|---|
| Cola de trabajos | No existe (CLAUDE.md la exige; PLAN no la define) |
| Concurrencia de exports | Ilimitada |
| Descargas | Síncronas: serializan **todo** el servidor |
| Cancelación de exports | No existe. Si el usuario cierra la pestaña, el job sigue |
| Idempotencia | Cada POST crea un job nuevo, aunque sea el mismo proyecto |
| Timeouts | Descarga: 5 min. ffmpeg: **sin timeout** |

## 5. Qué funciona, qué falla y qué no se pudo verificar

| Operación | Resultado |
|---|---|
| Health | ✔ Funciona (CE) |
| Validaciones 400 de download, export y files | ✔ Funcionan (CE) |
| Servir videos con Range | Funciona según el PLAN y los logs. No reprobado con un video real en esta auditoría |
| Subida de MP4 | Implementada. No reprobada (evitar escrituras). La evidencia indirecta son los 40+ archivos en `uploads` |
| Descarga YouTube/TikTok/Instagram | Implementada. No reprobada (evitar tráfico externo y escrituras). La evidencia indirecta son los archivos `*_youtube/tiktok/instagram.mp4` |
| Exportación | Produce MP4 reproducibles con fuentes homogéneas (CE sobre 4 exports existentes), pero con resolución, posiciones y estilos incorrectos (E-03, E-04). Sin verificar con fuentes mezcladas, títulos con `'` o saltos de línea, ni con fuentes del sistema en Linux |
| Comportamiento tras reinicio | Por código: jobs perdidos y archivos huérfanos (4 observados) |

## 6. Recomendaciones de arquitectura backend

1. Una capa `processRunner` única con `spawn(bin, args[])`, timeouts, límite de salida y cancelación.
2. Identificadores opacos de assets (`assetId` → ruta en el servidor). El cliente **nunca** envía rutas ni URLs para procesar.
3. Una cola (decisión pendiente) con concurrencia configurable y jobs persistidos.
4. `STORAGE_DIR` configurable por env y unificado.
5. Si se pasa a multiusuario: base de datos (por ejemplo PostgreSQL o Supabase) con tablas `users`, `projects`, `clips`, `assets`, `export_jobs`, almacenamiento de objetos (S3/R2/Supabase Storage) y autenticación. Es una decisión de producto que te corresponde a ti.
