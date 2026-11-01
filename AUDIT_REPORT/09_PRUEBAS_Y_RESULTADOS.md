# 09 — Pruebas y resultados

Todas las pruebas fueron **no destructivas**:
- No se instalaron dependencias.
- No se modificó código ni configuración.
- El build se generó en una carpeta temporal fuera del proyecto.
- Los servidores se levantaron en local y se detuvieron al terminar.
- No se ejecutaron descargas, subidas ni exportaciones nuevas.

## 1. Entorno
| Herramienta | Versión |
|---|---|
| SO | Windows 11 Home 10.0.26200 |
| Node / npm | 22.21.1 / 10.9.4 |
| ffmpeg / ffprobe | 9.0.2 (gyan.dev full build) |
| yt-dlp | 2026.10.21 |
| Dependencias | Ya instaladas (`node_modules` en la raíz y en `server/`) |

## 2. Comandos ejecutados y resultados

| # | Comando | Resultado |
|---|---|---|
| 1 | `tsc --noEmit -p tsconfig.json` (raíz) | ✅ 0 errores (configuración **no estricta**) |
| 2 | `tsc --noEmit -p server/tsconfig.json` | ✅ 0 errores (estricto) |
| 3 | `vite build --outDir <temporal>` | ✅ Build OK, 1.704 módulos, JS de 298 kB (86 kB gzip). ⚠ Aviso: `/index.css doesn't exist at build time` |
| 4 | Inspección del bundle | Sin `process.env` ni código de Gemini (eliminado por tree-shaking). 1 referencia fija a `localhost:3001`. **El correo personal del perfil por defecto está en el bundle** |
| 5 | `npm ls --depth=0` (raíz y servidor) | Versiones en 02 |
| 6 | `npm audit --omit=dev` (raíz) | ✅ 0 vulnerabilidades |
| 7 | `npm audit` (servidor) | ❌ 7: 1 crítica, 2 altas, 4 moderadas |
| 8 | `ffmpeg -version`, `ffprobe -version`, `yt-dlp --version` | ✅ Disponibles en el PATH |
| 9 | `ffprobe` sobre los 4 exports existentes | Todos h264 + aac, **360×640**, 30 fps, 30,1 s |
| 10 | `ffprobe` sobre 3 uploads (YouTube, TikTok, Instagram) | YouTube 360×640 a 48 kHz; TikTok 720×1280 a 44,1 kHz (audio como primer stream); Instagram 720×1280 a 48 kHz → **fuentes heterogéneas** |
| 11 | `ffmpeg -ss 2 -i <export> -frames:v 1` (a carpeta temporal) | Fotograma: título del clip "…4 Item" **cortado en el borde izquierdo**, fuente serif por defecto. El título principal no es visible en ese fotograma |
| 12 | `npx ts-node src/index.ts` (servidor) | ✅ Arranca en `:3001` |
| 13 | `vite --port 3000 --strictPort --host 127.0.0.1` | ✅ Arranca |
| 14 | `du -sh server/storage/*` | uploads ≈ 824 MB, exports ≈ 16 MB |

## 3. Pruebas de API (curl contra el servidor local)

| Petición | Esperado | Obtenido | Resultado |
|---|---|---|---|
| `GET /api/health` | 200 `{status:"ok"}` | 200 `{status:"ok"}` | ✅ |
| `GET /api/export/no-existe` | 404 | 404 `Job not found` | ✅ |
| `POST /api/download {url:"https://example.com/video"}` | 400 | 400 `Unsupported platform…` | ✅ |
| `POST /api/export {}` | 400 | 400 `Missing required fields…` | ✅ |
| `GET /api/files/..%2F..%2Fpackage.json` | Rechazo | 400 `Invalid filename` | ✅ Protegido |
| `GET /api/exports/..%2F..%2Fpackage.json` | Rechazo | **200 con el contenido de `server/package.json`** | ❌ **Path traversal (S-04)** |
| `GET /api/exports/..%5C..%5Cpackage.json` | Rechazo | **200** | ❌ S-04 |
| `GET /api/health` con `Origin: http://evil.example` | Sin ACAO para ese origen | `Access-Control-Allow-Origin: http://localhost:3000` | ✅ CORS correcto (el navegador bloquea la lectura) |
| `GET http://127.0.0.1:3000/` | 200 | 200 | ✅ |

## 4. Pruebas en el navegador (navegador integrado, solo lectura)

| Prueba | Resultado |
|---|---|
| Carga de Home en `localhost:3000` | ✅ Sin errores en consola. ⚠ Aviso de Tailwind CDN "should not be used in production" |
| Abrir **127.0.0.1**:3000 | La UI carga, pero el origen no coincide con el CORS (`localhost`): las llamadas al API fallarían (E-15) |
| Navegar a Editor | ✅ Se muestra el proyecto de ejemplo con 1 textarea |
| Video del proyecto de ejemplo | ❌ `<video>.error.code = 4`. `HEAD` a la URL de BigBuckBunny devuelve **403** (E-22) |
| Medida de la preview a 1024×768 | Interior de 160×306 px (el backend asume 540 px → E-04) |
| Medida a 375×812 (móvil) | Barra lateral de 80 px, preview de 181×344 px, sin scroll horizontal ✅ |
| Botones solo con icono sin nombre accesible | 16 |
| `<html lang>` | `en` fijo |
| `meta description` | No existe |
| Borrar el último proyecto | **No ejecutado**: el sistema de permisos lo bloqueó por ser una acción destructiva. Se mantiene como **CC** (E-01) |

## 5. Pruebas no realizadas y motivo

| Prueba | Motivo |
|---|---|
| Inyección de comandos (S-01, S-02, S-03) | Habría ejecutado comandos arbitrarios en la máquina del usuario. Confirmado solo por código |
| SSRF y lectura local vía export (S-05) | Generaría jobs de ffmpeg y archivos. Confirmado por código |
| Subida, descarga y exportación reales | Escriben en `server/storage` y hacen tráfico externo. Se usó como evidencia el material ya existente |
| Linter | **No hay linter configurado** (ni ESLint ni Prettier) |
| Tests unitarios, integración o e2e | **No existen.** No hay script `test` en ningún `package.json` |
| Scripts `test-*.js` | No ejecutados: requieren la app levantada, escriben capturas en la raíz del proyecto, y `test-phase1.js` está roto por inspección (`titleTextarea` no definido) |
| Despliegue y producción | No hay configuración de despliegue |

## 6. Cobertura de tests existente

**0 %.** Los 3 scripts `test-*.js` son rutinas manuales de Playwright sin aserciones, sin runner y sin integración en CI. `test-simple.js` registra los listeners de consola **después** de cargar la página, así que no captura los errores de carga.

## 7. Conclusión de la fase de pruebas

- El proyecto **compila** (frontend y backend) y **arranca** en local.
- La API valida correctamente los casos básicos de entrada, salvo la ruta de exports.
- La exportación produce archivos reproducibles, pero **no cumple** las especificaciones de resolución y posición.
- No hay ninguna red de seguridad automatizada: cualquier corrección futura debe ir acompañada de tests (ver P3-01).
