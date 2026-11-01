# 03 — Arquitectura del sistema

## 1. Vista general

```
┌──────────────────────────── Navegador ─────────────────────────────┐
│  index.html (Tailwind CDN + importmap residual)                    │
│   └─ index.tsx → <App/> (App.tsx, 1.334 líneas)                     │
│        ├─ Vistas: home | projects | editor | profile (estado local) │
│        ├─ ProfileView.tsx                                          │
│        ├─ TrimTimeline.tsx                                         │
│        ├─ ClipCard / ToolCard / SidebarItem / Toolbar* (en App.tsx)│
│        ├─ translations.ts (ES/EN)                                  │
│        ├─ services/geminiService.ts (NO usado)                     │
│        └─ localStorage: viral_ranker_projects | _profile | _lang | │
│                         _dark_mode                                 │
└─────────────┬──────────────────────────────────────────────────────┘
              │ fetch() directo a http://localhost:3001 (fijo en código)
              ▼
┌────────────────────── Express (server/src) :3001 ──────────────────┐
│ index.ts  CORS(FRONTEND_URL) + express.json()                      │
│  ├─ GET  /api/health                         routes/health.ts      │
│  ├─ POST /api/upload   (multer memoria 200MB) routes/upload.ts     │
│  │        └─ videoService: writeFile + ffprobe (execSync)          │
│  ├─ GET  /api/files/:filename (Range)         routes/files.ts      │
│  ├─ POST /api/download                        routes/download.ts   │
│  │        └─ downloadService: yt-dlp (execSync, bloqueante)        │
│  ├─ POST /api/export   → job en Map en memoria routes/export.ts    │
│  │        └─ exportService.processExportJob (async, sin cola)      │
│  │             └─ ffmpegService: trim → drawtext → concat (exec)   │
│  ├─ GET  /api/export/:jobId  (polling 500 ms)                       │
│  └─ GET  /api/exports/:filename (res.download)  index.ts (sin commit)│
└─────────────┬──────────────────────────────────────────────────────┘
              │ child_process (cadenas de shell)
              ▼
     ffmpeg / ffprobe / yt-dlp (binarios del sistema)
              │
              ▼
     server/storage/{uploads, processing, exports}  (disco local)
```

## 2. Componentes y responsabilidades

### Frontend
| Módulo | Responsabilidad | Observaciones |
|---|---|---|
| `App.tsx` | Estado global (proyectos, perfil, idioma, tema), navegación por pestañas, editor, preview, llamadas HTTP, export y polling, drag de títulos. Contiene además los componentes `ToolCard`, `SidebarItem`, `ToggleRow`, `ToolbarButton`, `ToolbarDropdown` y `ClipCard` | Monolito. Viola la regla de CLAUDE.md §4 "Servicios externos siempre en `services/`": las 3 integraciones HTTP están inline |
| `ProfileView.tsx` | Perfil, avatar, métricas, preferencias | Las preferencias no afectan al resto de la app (ver 04) |
| `TrimTimeline.tsx` | Barra de recorte con dos handles | Solo eventos de ratón |
| `types.ts` | `Clip`, `Project`, `CaptionStyle`, `AIRecommendation`, `UserProfile` | `CaptionStyle` no se usa como tipo de `STYLE_PRESETS` |
| `translations.ts` | Diccionario EN/ES | Muchas cadenas se resuelven con `lang === 'es' ? … : …` inline en lugar del diccionario |
| `services/geminiService.ts` | Llamada a Gemini | Sin uso |

No hay router: la navegación es `activeTab` en `useState` (`App.tsx:252`), así que no hay URLs por vista, recargar vuelve siempre a Home y el botón atrás del navegador no funciona.

### Backend
| Módulo | Responsabilidad |
|---|---|
| `index.ts` | Bootstrap, CORS, rutas, ruta de descarga de exports |
| `routes/*` | Validación mínima de entrada y respuesta HTTP |
| `services/videoService.ts` | Guardado y validación de uploads, ruta de archivos |
| `services/downloadService.ts` | Detección de plataforma y descarga con yt-dlp |
| `services/ffmpegService.ts` | Envoltorios de ffmpeg |
| `services/exportService.ts` | Ciclo de vida del job, mapeo de coordenadas, orquestación |

## 3. Flujo de datos de un clip (de punta a punta)

1. **Alta del clip:** botón "Add Clip" (`App.tsx:1139`) → crea `Clip` con `url: ''` → `updateCurrentProject` → `setProjects` → `useEffect` escribe en `localStorage`.
2. **Fuente del video:**
   - *Archivo:* `<input type=file>` → `handleFileUpload` (`App.tsx:404`) → `POST /api/upload` (multipart) → multer guarda en RAM → `saveUploadedVideo` lo escribe en `storage/uploads/<timestamp>_<nombreOriginal>` → `ffprobe` → responde `{ videoUrl: '/api/files/<archivo>', duration }` → el frontend lo convierte a `http://localhost:3001/api/files/...` y lo guarda en `clip.url`.
   - *Enlace:* `onChange` del input (`App.tsx:1305`) → `handleDownloadUrl` → `POST /api/download` → `execSync(yt-dlp …)` (bloquea el servidor hasta 5 min) → misma respuesta.
3. **Reproducción:** `<video src=clip.url>` → `GET /api/files/:filename` con Range.
4. **Edición:** trim (`TrimTimeline` o inputs numéricos), título del clip, posición arrastrable (`clipTitlePosition`, en **píxeles de la preview**).
5. **Exportación:** `handleExport` (`App.tsx:479`) envía `{projectId, title, titlePosition, titleStroke, clips[]}` donde `clips[].url` es la URL absoluta `http://localhost:3001/...` → backend crea el job → `processExportJob` ordena por `rank`, y para cada clip hace `ffmpeg -i <URL HTTP>` (ffmpeg se descarga el archivo **desde el propio servidor por HTTP**), trim, drawtext y concat → `storage/exports/<jobId>.mp4` → el frontend hace polling cada 500 ms → al completar crea un `<a download>` hacia `/api/exports/<jobId>.mp4`.

## 4. Persistencia y estado

| Dato | Dónde vive | Durabilidad |
|---|---|---|
| Proyectos, clips, posiciones | `localStorage` (`viral_ranker_projects`) | Por navegador. Sin versión de esquema ni validación al leer |
| Perfil | `localStorage` (`viral_ranker_profile`) | Por navegador |
| Archivos de video | `server/storage/uploads` | Indefinida (sin limpieza, ~824 MB hoy) |
| Jobs de exportación | `Map` en memoria (`exportService.ts:56`) | Se pierden al reiniciar el servidor |
| Exports | `server/storage/exports` | 1 h si el proceso sigue vivo. Si se reinicia, quedan huérfanos (hay 4 hoy) |

Hay un acoplamiento frágil: los proyectos guardados en el navegador contienen URLs absolutas `http://localhost:3001/api/files/...`. Si cambia el host o el puerto, o se borra `storage/uploads`, todos los proyectos quedan con videos rotos y no hay mecanismo de recuperación.

## 5. Rutas de almacenamiento inconsistentes

| Archivo | Base usada |
|---|---|
| `videoService.ts:5`, `downloadService.ts:5` | `process.cwd()/storage/uploads` |
| `exportService.ts:45` | `__dirname/../../storage` |
| `index.ts:35` | `__dirname/../storage/exports` |

Con `npm run dev` lanzado desde `server/` todas coinciden. Si el proceso se arranca desde otro directorio (por ejemplo `node server/dist/index.js` desde la raíz), los uploads irán a otra carpeta distinta de la de exports.

## 6. Comunicación y contratos

- No existe un cliente API tipado ni tipos compartidos entre frontend y backend. `ExportRequest` (`exportService.ts:27`) y el objeto que construye `handleExport` se mantienen sincronizados a mano.
- El frontend envía `titleStyle: { color: '#FFFFFF' }` fijo (`App.tsx:503`), y el backend lo ignora de todos modos, porque usa `'#FFFFFF'` fijo en `exportService.ts:188,190`.
- No hay versionado de API, ni manejo de errores uniforme, ni ningún middleware de errores global en Express.

## 7. Elementos que no existen

Base de datos, autenticación, usuarios en servidor, roles, panel de administración, webhooks, notificaciones, pagos, cola de trabajos, almacenamiento cloud, CI/CD, contenedores y monitorización.
