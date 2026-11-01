# 07 — Auditoría de seguridad

> No se muestran credenciales. **No se ejecutó ninguna inyección de comandos**: esos hallazgos se confirman por lectura de código, porque probarlos implicaría ejecutar comandos arbitrarios. El path traversal (S-04) sí se confirmó en ejecución contra el servidor **local**, leyendo un archivo inocuo (`server/package.json`).

## Contexto de exposición

- Express escucha en **todas las interfaces** (`app.listen(PORT)` sin host, `server/src/index.ts:45`). Vite también (`host: '0.0.0.0'`, `vite.config.ts:9`). `frontend.log` muestra el servidor accesible en IPs de la LAN (192.168.x.x).
- **Ningún endpoint tiene autenticación.** CORS solo impide que *otro sitio web lea* las respuestas: no impide que cualquier cliente (curl, otro equipo de la red) llame a la API.
- Por tanto, hoy las vulnerabilidades son explotables **por cualquier dispositivo de la misma red** y, en algunos casos, **por cualquier página web que visites** (ver S-02).

## Hallazgos

### S-01 — Inyección de comandos en `/api/download` · **Crítica** · CC
- **Archivo:** `server/src/services/downloadService.ts:67-70`.
- **Causa:** `` const command = `yt-dlp -f best[ext=mp4] -o "${filePath}" "${url}" 2>&1`; execSync(command) ``. Se usa la URL **original** del cliente. `new URL()` (`routes/download.ts:22`) solo valida que sea parseable y no la normaliza en el comando. La comprobación `hostname.includes('youtube.com')` es fácil de cumplir.
- **Vector:** una URL con un host válido y metacaracteres de shell en la ruta o la query. En Linux, `$(...)` o comillas que cierren el argumento. En Windows (`cmd.exe`), `"` seguido de `&`.
- **Impacto:** ejecución remota de código con los permisos del proceso Node: lectura del disco, robo de `.env`, persistencia.
- **Solución:** `execFile('yt-dlp', ['-f', fmt, '-o', filePath, '--', url])` sin shell. Allowlist de hosts por igualdad o sufijo (`host === 'youtube.com' || host.endsWith('.youtube.com')`). Usar `urlObj.href` normalizado.

### S-02 — Inyección de comandos vía nombre de archivo en `/api/upload` · **Crítica en Linux / Baja en Windows** · CC
- **Archivo:** `videoService.ts:86` (nombre con `basename(originalname)`), `49-50` y `69-70` (`execSync` con `"${filePath}"`).
- **Causa:** el `originalname` lo controla el cliente. En Linux un nombre puede contener `$(...)` o `"`, que dentro de comillas dobles se ejecutan o rompen el argumento. En Windows `"` no es válido en un nombre de archivo y `writeFileSync` falla antes, así que el riesgo es menor.
- **Agravante (vector tipo CSRF):** `POST multipart/form-data` es una petición "simple" según CORS: **cualquier página web** abierta en el navegador del usuario puede enviarla a `http://localhost:3001/api/upload` sin preflight. CORS bloquea la lectura de la respuesta, pero el servidor procesa el archivo.
- **Solución:** generar el nombre en el servidor (`<uuid>.mp4`), no reutilizar nunca `originalname` en rutas, usar `execFile` y rechazar peticiones sin un token o cabecera personalizada (fuerza el preflight).

### S-03 — Inyección de comandos y de filtros en `/api/export` · **Crítica** · CC
- **Archivos:** `ffmpegService.ts:39, 46` (`"${inputPath}"` con `clip.url` del cliente), `77-88` y `98` (títulos en `-vf "…"`).
- **Causa:**
  1. `clip.url` va directo a `-i "<url>"` en el shell.
  2. Los títulos solo escapan `'` y `:`. Unas comillas dobles en el título cierran el argumento `-vf "…"` del shell. En Linux, `$(...)` o `` `...` `` dentro de las comillas se ejecutan. El backend **no limita la longitud ni el contenido** del título (el `maxLength=32` es solo de UI).
  3. Además de la inyección de shell, el texto permite **inyectar filtros de ffmpeg** (`,` `;` `[` sin escapar), que pueden leer o escribir archivos con filtros como `movie=`.
- **Solución:** `spawn('ffmpeg', args[])` y el texto vía `textfile=` (archivo temporal) con `expansion=none`. Validar la longitud y los caracteres del título en el servidor.

### S-04 — Path traversal en `/api/exports/:filename` · **Crítica** · **CE**
- **Archivo:** `server/src/index.ts:35-43` (**cambio sin commitear**).
- **Causa:** `path.join(EXPORTS_DIR, req.params.filename)` sin validar. Express decodifica `%2F` y `%5C` en los parámetros.
- **Prueba realizada (local, inocua):** `GET /api/exports/..%2F..%2Fpackage.json` → **200** con el contenido de `server/package.json`. `..%5C..%5Cpackage.json` → **200**.
- **Impacto:** lectura de **cualquier archivo** accesible al proceso: `server/.env`, código fuente, archivos del usuario en el disco.
- **Solución:** validar `^[0-9a-f-]{36}\.mp4$` y comprobar que `path.resolve(...)` empiece por `EXPORTS_DIR + path.sep`. Para descargas, usar `res.download` sobre la ruta reconstruida con el `jobId` del job existente.

### S-05 — SSRF y lectura de archivos locales mediante ffmpeg · **Crítica** · CC
- **Archivo:** `exportService.ts:157-159`, `ffmpegService.ts:39`.
- **Causa:** el backend acepta cualquier `clip.url`. Si empieza por `http`, ffmpeg la descarga desde **cualquier host**: red interna, servicios de metadatos cloud, `localhost` de otros servicios. Si no, `path.join(STORAGE_BASE, url)` admite `../../...`, así que ffmpeg lee cualquier archivo local, y ffmpeg soporta además otros protocolos (`file:`, `concat:`, `subfile:` …).
- **Impacto:** exfiltración de archivos multimedia u otros datos codificados en el video, escaneo de la red interna y consumo de recursos.
- **Solución:** el cliente envía `assetId` y el servidor resuelve la ruta en `UPLOAD_DIR`. Añadir `-protocol_whitelist file` en ffmpeg.

### S-06 — Ausencia de autenticación y exposición en red · **Alta** · CE
- **Archivos:** `server/src/index.ts:45`, `vite.config.ts:9`.
- **Impacto:** cualquier equipo de la LAN usa la API (subir, descargar, exportar, leer archivos vía S-04). Es el multiplicador de S-01 a S-05.
- **Solución:** en desarrollo, `app.listen(PORT, '127.0.0.1')` y quitar `host: '0.0.0.0'`. En producción, autenticación (sesión o JWT) y autorización por propietario de assets y jobs.

### S-07 — Denegación de servicio · **Alta** · CC
- `execSync` bloquea el event loop durante hasta 5 min por descarga (E-16).
- Exports ilimitados en paralelo y sin timeout de ffmpeg (E-17).
- Uploads de 200 MB en RAM (E-19).
- Descargas sin límite de duración ni tamaño.
- Disco sin cuotas (824 MB acumulados ya).
- Sin rate limiting.
- **Solución:** cola con concurrencia, `--max-filesize` y `--match-filter "duration < 600"` en yt-dlp, `diskStorage`, `express-rate-limit`, cuotas y limpieza.

### S-08 — Allowlist de plataformas eludible · **Alta** · CC
- **Archivo:** `downloadService.ts:21-29` (`hostname.includes(...)`).
- **Impacto:** `https://youtube.com.dominio-atacante.tld/...` pasa la validación y yt-dlp (extractor genérico) descarga desde **cualquier sitio**. Es SSRF y abre una vía a archivos no deseados.
- **Solución:** comparación exacta o por sufijo con punto, y restringir yt-dlp a los extractores permitidos (`--use-extractors youtube,tiktok,instagram`), que también desactiva el extractor genérico.

### S-09 — Validación de uploads ineficaz · **Media** · CC
- `isValidMP4` acepta cualquier archivo legible por ffprobe (`format_name` siempre aparece, `videoService.ts:53`). El cliente valida el MIME, pero eso no es una barrera.
- **Solución:** comprobar `format_name` en `{mov,mp4,m4a,3gp,3g2,mj2}`, que exista al menos un stream de vídeo h264/hevc/vp9/av1 y límites de duración y resolución.

### S-10 — Datos personales en el código y en el bundle · **Media** · CE
- **Archivo:** `App.tsx:161-165` (`DEFAULT_PROFILE`: nombre completo y correo personal reales del autor).
- **Verificado:** el correo aparece literalmente en el JS de producción (`vite build`). Cualquier visitante del sitio desplegado lo vería y queda en el historial de git.
- **Solución:** perfil por defecto genérico ("Creator", sin email).

### S-11 — Clave de Gemini destinada al bundle del cliente · **Alta (latente)** · CC
- **Archivo:** `vite.config.ts:13-14` (`define: process.env.API_KEY`), `services/geminiService.ts:4`.
- **Estado hoy:** no hay `.env.local` y la función no se usa (Rollup la elimina). En cuanto se integre la IA, la clave quedará **en texto plano en el JS público**.
- **Solución:** llamar a Gemini **desde el backend** (`/api/ai/ranking`) con la clave en `server/.env`, con rate limit por usuario. Además, el `topic` se interpola en el prompt sin delimitar (`geminiService.ts:9`), lo que permite inyección de prompt. El impacto es bajo porque se valida un esquema JSON.

### S-12 — Exposición de información en logs y errores · **Baja** · CC
- `routes/export.ts:13-16` registra **todas las cabeceras** y el cuerpo completo de cada petición. Si en el futuro hay cookies o tokens, quedarán en los logs.
- `downloadService.ts:88` devuelve al cliente fragmentos de la salida interna de yt-dlp. `upload.ts:66` devuelve `error.message` interno.
- **Solución:** logger con niveles y redacción de datos sensibles, y mensajes de error genéricos al cliente.

### S-13 — Dependencias vulnerables · **Media** · CE
`npm audit` del servidor: proxy-addr (crítica, mitigada porque no hay `trust proxy`), body-parser (alta, DoS), brace-expansion (alta, solo dev), qs, minimatch y uuid (moderadas). Frontend: 0. **Solución:** `npm audit fix` (sin breaking) y plan para uuid y nodemon.

### S-14 — Riesgos legales y de cumplimiento · **Media** · CC
Descargar contenido de YouTube, TikTok o Instagram puede infringir sus términos de servicio y derechos de autor. El PLAN lo anota como deuda ("advertencia legal"). Sin aviso, términos de uso ni política de privacidad. No es una vulnerabilidad técnica, pero bloquea un lanzamiento público.

## Revisiones sin hallazgos

| Área | Resultado |
|---|---|
| XSS | Sin `dangerouslySetInnerHTML`, `innerHTML` ni `eval` en el código propio (grep). React escapa el texto. Bajo riesgo |
| Inyección SQL | No hay base de datos |
| Sesiones y tokens | No existen |
| CSRF clásico | No hay cookies de sesión. El vector relevante es el de peticiones "simples" a localhost (ver S-02) |
| CORS | Origen único y correcto. `credentials: true` innecesario (no hay cookies) |
| Secretos en el repo | `server/.env` está en `.gitignore` y no está versionado (`git ls-files`). No se encontraron claves en el código |
| `/api/files/:filename` | Traversal bloqueado (CE: 400) |

## Matriz de riesgo

| ID | Probabilidad | Impacto | Riesgo |
|---|---|---|---|
| S-01 | Alta (endpoint público, trivial) | Crítico (RCE) | **Crítico** |
| S-03 | Alta | Crítico (RCE) | **Crítico** |
| S-04 | Alta | Alto (lectura de archivos) | **Crítico** |
| S-05 | Alta | Alto | **Crítico** |
| S-02 | Media (Linux) | Crítico | **Crítico (Linux)** |
| S-06 | Alta | Multiplicador | Alto |
| S-07 | Alta | Medio | Alto |
| S-08 | Media | Medio | Alto |
| S-11 | Segura al integrar la IA | Alto (coste y abuso) | Alto (latente) |
| S-09, S-10, S-13, S-14 | — | — | Medio |
| S-12 | — | — | Bajo |
