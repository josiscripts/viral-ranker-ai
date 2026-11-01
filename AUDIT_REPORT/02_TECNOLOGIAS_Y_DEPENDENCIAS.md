# 02 — Tecnologías y dependencias

## 1. Lenguajes

| Lenguaje | Dónde | Notas |
|---|---|---|
| TypeScript / TSX | Frontend (`*.tsx`, `types.ts`, `translations.ts`, `services/`) y backend (`server/src`) | Frontend **sin** `strict` (`tsconfig.json`); backend con `strict: true` (`server/tsconfig.json:9`) |
| JavaScript (ESM) | `test-debug.js`, `test-phase1.js`, `test-simple.js` (scripts Playwright) y `server/dist/*.js` (build obsoleto) | |
| HTML/CSS | `index.html` (estilos inline + Tailwind CDN) | |
| Batch | `server/start-dev.bat` | Solo Windows |

## 2. Frontend — versiones instaladas (`npm ls --depth=0`)

| Paquete | Declarado (`package.json`) | Instalado | Uso real |
|---|---|---|---|
| react / react-dom | ^19.2.3 | 19.2.7 | Sí |
| lucide-react | ^0.562.0 | 0.562.0 | Sí (17 iconos importados sin uso en `App.tsx`) |
| @google/genai | ^1.35.0 | 1.52.0 | **No.** `generateRankingScript` se importa en `App.tsx:57` pero nunca se llama. Rollup lo elimina del bundle (verificado: 0 apariciones de `gemini-3-flash` en el build) |
| vite | ^6.2.0 | 6.4.3 | Sí |
| @vitejs/plugin-react | ^5.0.0 | 5.2.0 | Sí |
| typescript | ~5.8.2 | 5.8.3 | Sí |
| @types/node | ^22.14.0 | 22.20.1 | Sí |
| playwright | ^1.61.1 (devDep) | 1.61.1 | Solo en los scripts `test-*.js` |

**Cargadas fuera de npm (`index.html`):**
- `https://cdn.tailwindcss.com` sin versión fija (`index.html:7`). La consola muestra el aviso oficial de que no debe usarse en producción (verificado en el navegador).
- Google Fonts (Inter).
- Un `importmap` hacia `esm.sh` con rangos `^` (`index.html:34-43`). Es un residuo de Google AI Studio: Vite empaqueta las dependencias desde `node_modules`, así que en la práctica el importmap no se usa. Aun así confunde, y **CLAUDE.md** exige decidir "npm, importmap o ambas" para cada dependencia, lo que es una fuente de errores.
- `<link rel="stylesheet" href="/index.css">` (`index.html:45`) apunta a un archivo que **no existe** (Vite avisa en el build).

**Gestores de paquetes:** conviven `package-lock.json` y `bun.lock` en la raíz. Hay dos lockfiles para un solo proyecto y pueden divergir.

## 3. Backend — versiones instaladas

| Paquete | Declarado | Instalado | Uso |
|---|---|---|---|
| express | ^4.18.2 | 4.22.2 | Servidor HTTP |
| cors | ^2.8.5 | 2.8.6 | CORS |
| dotenv | ^16.3.1 | 16.6.1 | Variables de entorno |
| multer | ^1.4.5-lts.1 | 1.4.5-lts.2 | Subida de archivos (en memoria) |
| uuid | ^9.0.0 | 9.0.1 | IDs de jobs |
| typescript / ts-node / nodemon | dev | 5.9.3 / 10.9.2 / 3.1.14 | Desarrollo |
| @types/* | dev | — | Tipos |

**Binarios externos (no gestionados por npm), verificados en esta máquina:**

| Binario | Versión | Uso |
|---|---|---|
| ffmpeg / ffprobe | 9.0.2 (build gyan.dev) | Trim, drawtext, concat, validación, duración |
| yt-dlp | 2026.10.21 | Descarga de YouTube/TikTok/Instagram |
| Node.js | 22.21.1 | Runtime |

El servidor **depende de que ambos binarios estén en el PATH**. No se valida al arrancar y no hay Dockerfile ni otro mecanismo que los aprovisione. Esto bloquea el despliegue.

## 4. Vulnerabilidades de dependencias (`npm audit`, ejecutado)

**Frontend (`--omit=dev`):** 0 vulnerabilidades.

**Servidor:** 7 vulnerabilidades.

| Paquete (transitivo) | Severidad | Vía | Corrección |
|---|---|---|---|
| proxy-addr 2.0.7 | **Crítica** (spoofing de IP con `trust proxy`) | express | `npm audit fix` (sin breaking) |
| body-parser < 1.20.9 | Alta (DoS con cuerpo comprimido) | express | `npm audit fix` |
| brace-expansion | Alta (DoS) | nodemon → minimatch (dev) | `npm audit fix` |
| qs ≤ 6.16.0 | Moderada (DoS) | express | `npm audit fix` |
| minimatch < 11.0.1 | Moderada | nodemon (dev) | breaking |
| uuid < 11.1.1 | Moderada (no afecta a `v4()` sin buffer, que es el uso actual) | directo | breaking (uuid@14) o usar `crypto.randomUUID()` |

Nota: la app no activa `trust proxy`, así que el impacto real de proxy-addr hoy es bajo. Igualmente debe actualizarse antes de desplegar detrás de un proxy.

## 5. Variables de entorno (sin valores)

| Variable | Dónde se lee | Obligatoria | Estado |
|---|---|---|---|
| `GEMINI_API_KEY` | `vite.config.ts:13-14` → se inyecta en el **bundle del cliente** como `process.env.API_KEY` | No (la IA no se usa) | No existe `.env.local` en la raíz |
| `PORT` | `server/src/index.ts:15` | No (por defecto 3001) | En `server/.env` (gitignored, no versionado) |
| `FRONTEND_URL` | `server/src/index.ts:16` | No (por defecto `http://localhost:3000`) | En `server/.env` |
| `NODE_ENV` | Declarada en `.env.example` | — | **No se lee en ningún sitio** |
| URL del backend en el frontend | — | — | **No existe**: está fija como `http://localhost:3001` en 7 lugares de `App.tsx` |

## 6. Configuración analizada

| Archivo | Observaciones |
|---|---|
| `vite.config.ts` | `host: '0.0.0.0'` expone el dev server a la LAN (el `frontend.log` muestra IPs 192.168.x). Sin `strictPort`: si el puerto 3000 está ocupado salta a 3002 y **rompe CORS** (pasó, según `frontend.log`). Inyecta la key de Gemini en el cliente. |
| `tsconfig.json` (raíz) | Sin `strict`, sin `include`. `allowJs: true`. |
| `server/tsconfig.json` | `strict`, CommonJS, `outDir: dist`. |
| `server/package.json` | `start` ejecuta `dist/index.js`, que está **obsoleto** (ver 05). |
| `.gitignore` | Correcto: ignora `.env`, `server/storage`, `dist`, `node_modules`. `debug-page.png`, `frontend.log` y los `test-*.js` sí están versionados o en la raíz. |
| `metadata.json` | Metadatos de Google AI Studio. Sin efecto en la app. |

## 7. Archivos obsoletos, duplicados o innecesarios

| Archivo / elemento | Motivo |
|---|---|
| `server/dist/` | Build ESM antiguo (fases 0–3): no contiene `export.js`, `ffmpegService.js` ni `exportService.js` |
| `bun.lock` | Segundo lockfile |
| `README.md` raíz | Plantilla de Google AI Studio, no describe el proyecto real |
| `test-debug.js`, `test-simple.js`, `test-phase1.js` | Scripts manuales, no son tests. `test-phase1.js` usa variables no definidas (`titleTextarea`, `mobileTextarea`) |
| `debug-page.png`, `frontend.log`, `server/server.log` | Artefactos de depuración |
| `importmap` en `index.html` | Residuo de AI Studio |
| `services/geminiService.ts` | Sin uso |
| `getVideoDuration` | Implementada **3 veces**: `videoService.ts:66`, `downloadService.ts:37`, `ffmpegService.ts:195` (esta última, importada en `exportService.ts` sin usarse) |
| `handleMulterError` (`upload.ts:15-25`), `cleanupJobsManually` (`exportService.ts:247`) | Sin uso |
| Estados `isGenerating`, `exportJobId` (`App.tsx:253,260`) | Sin lectura |
| `topPosition`/`containerGap` de `getClipLayoutConfig` | Calculados pero nunca usados |
| 17 iconos importados sin uso en `App.tsx` | Library, Sparkles, Settings, ArrowDown, ExternalLink, AlertCircle, Bold, RotateCcw, RotateCw, FastForward, Rewind, Move, MoreVertical, LayoutDashboard, Layers, GripVertical, Languages |
| `useCallback` | Importado y sin uso (`App.tsx:2`) |
