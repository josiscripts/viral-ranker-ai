# 01 — Resumen general

**Proyecto:** Viral Ranker AI
**Fecha de la auditoría:** 2026-11-01
**Rama / commit base:** `main` @ `e8ce780`, con 3 archivos modificados sin commitear (`server/src/index.ts`, `server/src/services/exportService.ts`, `server/src/services/ffmpegService.ts`).
**Alcance:** todo el repositorio local (frontend, backend, configuración, documentación, scripts, artefactos en `server/storage` y `server/dist`).

## Qué es

Una aplicación web para crear videos verticales tipo "Top N" (TikTok, Reels, Shorts). El usuario arma un proyecto, añade hasta 10 clips (subiendo un `.mp4` o pegando un enlace de YouTube, TikTok o Instagram), define el recorte de cada clip, escribe un título principal y un título por clip, y exporta un único `.mp4`.

## Cómo está construida

| Capa | Tecnología | Estado |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite 6, Tailwind por CDN, lucide-react | Construido, funciona en local |
| Persistencia | `localStorage` del navegador | Funciona, sin backend de datos |
| Backend | Node 22 + Express 4 + TypeScript (CommonJS, ts-node) | Funciona en local |
| Procesamiento | `ffmpeg`/`ffprobe` 9.0.2 y `yt-dlp` 2026.10.21 vía `child_process` | Funciona con limitaciones graves |
| IA | `@google/genai` (Gemini) | Código presente pero **sin usar** |
| Base de datos, auth, pagos, despliegue | — | **No existen** |

## Veredicto

La aplicación **funciona como prototipo local de un solo usuario**: la interfaz carga, los proyectos se guardan en el navegador, la subida y la descarga de videos funcionan y el backend produce un `.mp4`. **No está lista para producción**, ni cerca, por tres grupos de problemas:

1. **Seguridad crítica (bloqueante).** El backend construye comandos de shell concatenando datos del usuario (URL, nombre de archivo, títulos, URL de clips). Esto permite **inyección de comandos** (ejecución remota de código) en `/api/download`, `/api/upload` y `/api/export`. Además hay un **path traversal confirmado en ejecución** en `/api/exports/:filename` (código sin commitear) y el endpoint de exportación permite que `ffmpeg` lea **URLs arbitrarias y archivos locales del servidor**. Ningún endpoint tiene autenticación y ambos servidores escuchan en todas las interfaces de red.
2. **La exportación no produce lo que promete el PLAN.** Verificado con `ffprobe` sobre los 4 exports existentes: salen a **360×640**, no a 1080×1920. Un fotograma extraído muestra el título del clip **cortado en el borde izquierdo**, con la fuente por defecto de ffmpeg. La conversión de coordenadas preview→video es incorrecta, se ignoran el fondo, el layout, los estilos y la lista de rankings, y concatenar clips de distintas fuentes con `-c copy` produce un video corrupto. Si la exportación falla, **el error nunca se muestra** al usuario (`exportError` se guarda pero no se renderiza).
3. **Bugs funcionales y deuda.** Borrar el último proyecto deja la app en pantalla blanca (hasta recargar, y el borrado no se guarda). El campo de enlace dispara la descarga en cada pulsación de tecla. `npm start` del servidor ejecuta un `dist/` obsoleto sin las rutas de exportación. Las URLs `http://localhost:3001` están fijas en el código. No hay tests reales ni linter. La documentación (`CLAUDE.md`, READMEs) está desactualizada y `PLAN.md` marca como ✅ fases con criterios que no se cumplen.

## Cifras clave

| Indicador | Valor | Evidencia |
|---|---|---|
| Líneas de código propio (TS/TSX) | ~3.200 | `wc -l` |
| `App.tsx` (monolito) | 1.334 líneas | `wc -l App.tsx` |
| Endpoints HTTP | 7 | `server/src/routes/*`, `server/src/index.ts` |
| `tsc --noEmit` frontend / servidor | 0 errores / 0 errores | Ejecutado |
| `vite build` | OK (298 kB JS) | Ejecutado (a carpeta temporal) |
| `npm audit` frontend (prod) | 0 vulnerabilidades | Ejecutado |
| `npm audit` servidor | 7 (1 crítica, 2 altas, 4 moderadas) | Ejecutado |
| Tests automatizados | 0 válidos (3 scripts Playwright ad-hoc, 1 roto) | Inspección |
| Espacio en `server/storage/uploads` | ~824 MB sin limpieza | `du -sh` |
| Hallazgos de seguridad críticos | 5 | Ver `07_AUDITORIA_DE_SEGURIDAD.md` |

## Qué hacer primero

1. Cerrar las vulnerabilidades críticas (P0-01 a P0-05): reemplazar `exec`/`execSync` con cadenas por `execFile`/`spawn` con argumentos en array, validar nombres de archivo, y aceptar en la exportación solo identificadores de archivos subidos, nunca URLs.
2. Arreglar el crash al borrar proyectos y mostrar los errores de exportación (P0-04, P1-01).
3. Rehacer el pipeline de exportación con coordenadas normalizadas y una salida 1080×1920 uniforme (P1-02, P1-03). Antes de esto **tú tienes que decidir** qué elementos visuales deben quedar incrustados en el video final.

El roadmap completo está en `12_PLAN_DE_DESARROLLO.md` y la vista consolidada en `INFORME_MAESTRO.md`.

## Limitaciones de esta auditoría

- No se modificó código, no se instalaron dependencias y no se hizo commit de nada.
- **No** se probó la inyección de comandos ejecutándola. Se confirma solo por inspección del código, porque probarla significaría ejecutar comandos arbitrarios en tu máquina.
- **No** se probaron descargas reales ni exportaciones nuevas. Sobre la exportación se analizaron los 4 archivos que ya existían en `server/storage/exports`.
- La prueba de "borrar el último proyecto" en el navegador fue bloqueada por el sistema de permisos. Ese bug queda **confirmado por inspección de código, no por ejecución**.
- No existe entorno de producción, base de datos ni servicios cloud que auditar.
