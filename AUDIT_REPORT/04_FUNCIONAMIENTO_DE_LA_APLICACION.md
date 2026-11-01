# 04 — Funcionamiento de la aplicación

## 1. Objetivo y usuarios

- **Objetivo:** producir un `.mp4` vertical tipo ranking a partir de hasta 10 clips, con títulos incrustados.
- **Tipos de usuario:** uno solo, el creador local. No existen roles, cuentas, autenticación ni administración. El "perfil" es un objeto en `localStorage` que se inicializa con **datos personales reales del autor fijados en el código** (`App.tsx:161-177`).

## 2. Navegación

Barra lateral con 4 pestañas (`App.tsx:792-795`): **Home**, **Projects**, **Editor**, **Profile**. Además hay un selector de tema claro/oscuro y otro de idioma EN/ES. No hay rutas URL: al recargar siempre se abre Home y el botón atrás del navegador no navega entre vistas.

## 3. Flujos funcionales reconstruidos

En cada flujo se indica cómo se verificó: ✔ verificado ejecutando, 👁 solo por inspección de código.

### 3.1 Home
- Tres tarjetas: **Ranking Editor** → Projects ✔, **Video Editor** → Editor ✔, **Quick Export** → `onClick={() => {}}` (`App.tsx:876`): **no hace nada** 👁.
- `ToolCard` acepta la prop `lang`, pero nunca se le pasa, así que el texto "Open Tool" sale siempre en inglés (`App.tsx:1257`) 👁.

### 3.2 Proyectos (CRUD local)
| Operación | Implementación | Estado |
|---|---|---|
| Crear | `handleCreateNewProject` (`App.tsx:471`) crea un proyecto con valores fijos y abre el editor | Funciona 👁. Ignora las preferencias del perfil (`defaultCaptionStyle`) |
| Listar | Grid con miniatura (`<video>` del primer clip) | Funciona ✔ |
| Renombrar | Edición inline, Enter guarda y Escape cancela | Funciona 👁. Sin límite de 32 caracteres (el editor sí lo tiene) |
| Eliminar | `window.confirm` (`App.tsx:199`) | **Bug crítico** si se elimina el último proyecto (ver 05, E-01) |
| Duplicar / importar / exportar proyecto | — | CLAUDE.md menciona "export/import de proyectos", pero **no existe en el código** |

### 3.3 Editor: título principal
- Textarea con `maxLength={32}` y contador (`App.tsx:1038-1049`) 👁. El proyecto de ejemplo trae un título de **36 caracteres** (`App.tsx:149`), por encima del límite.
- Pulsar sobre una palabra de la preview la resalta con el color de acento del estilo (`highlightedIndices`). Solo se ve en la preview: **no se exporta**.
- El arrastre se activa con el toggle "Enable Title Drag". Tiene clamping a los bordes y la posición se guarda en **píxeles relativos al centro de la preview** (`App.tsx:625-659`).
- El grosor de contorno (`titleStroke`) se persiste. El **color** de contorno (`strokeColor`, `App.tsx:263`) es estado volátil: se pierde al recargar y no se exporta.
- Las 9 plantillas de estilo (`STYLE_PRESETS`) se aplican a la preview. **No se exportan.**
- La barra de herramientas (emoji, A, B, cursiva, tipografías, "AI", alinear, deshacer y rehacer, `App.tsx:1022-1035`) son **11 botones sin `onClick`**: decoración sin funcionalidad.

### 3.4 Editor: layout
- "Video Layout Height" (40–100%), con un mínimo calculado según el número de clips. Solo afecta a la preview.
- "Canvas Background" (color). Solo preview.
- "Dynamic Captions" oculta los títulos en la preview. No se persiste.

### 3.5 Clips
| Paso | Implementación | Estado |
|---|---|---|
| Añadir (máx. 10) | Botón deshabilitado con 10 clips, contador X/10 | Funciona 👁 |
| Rango | `rank = clips.length + 1` al crear | **Sin reordenar y sin renumerar al borrar**: se pueden generar rangos duplicados o con huecos (E-12) |
| Subir `.mp4` | `handleFileUpload` → `/api/upload` | Funciona según el PLAN. Se observan 40+ archivos subidos en `storage/uploads`. No reprobado en esta auditoría |
| Pegar enlace | `onChange` → `handleDownloadUrl` | Funciona solo si se **pega** la URL completa. Al teclear, dispara la descarga en cuanto el texto empieza por `http://` (E-05) |
| Título del clip | Input inline y menú (mayúsculas, minúsculas, capitalizar, cursiva) | Funciona 👁 |
| Posición del título del clip | Arrastrable si "Enable Title Drag" está activo | Funciona 👁. Falla tras cambiar de proyecto (E-09) |
| Trim | `TrimTimeline` (si hay `duration`) e inputs numéricos | La timeline valida `start < end`. **Los inputs numéricos no validan nada**: aceptan negativos, `start > end` o valores mayores que la duración (E-13) |
| Preview | `<video autoPlay loop>` del clip activo | Al reproducir **ignora el rango de trim**: hace loop del archivo completo (E-10) |
| Navegar clips | Botones anterior y siguiente | Funciona 👁 |
| Barra de progreso de reproducción | Calculada en el render con `videoRef.current` (`App.tsx:1241`) | **No se actualiza** mientras el video avanza (no hay `timeupdate`) |

### 3.6 Exportación
1. Botón **EXPORT** → `handleExport` (`App.tsx:479`).
2. Si no hay clips → `setExportError('No clips to export')` → **no se muestra nada** al usuario: `exportError` nunca se renderiza (E-02).
3. `POST /api/export` → `jobId` → polling cada 500 ms (hasta 5 min) → overlay "Encoding..." con barra de progreso.
4. Backend: ordena por `rank`, recorta cada clip, aplica 2 `drawtext` (título principal y título del clip) en blanco con borde negro y fuente por defecto, y concatena con `-c copy`.
5. Al completar se descarga automáticamente `/api/exports/<jobId>.mp4`.
6. Si algo falla, el overlay desaparece **sin mensaje** (E-02).

**Lo que realmente contiene el video exportado** (verificado con `ffprobe` y un fotograma de un export existente):
- La resolución es la del **primer clip de origen** (360×640 en los 4 exports existentes). No se escala a 1080×1920.
- Los títulos aparecen en posiciones que **no coinciden** con la preview. En el fotograma analizado, el título del clip ("…4 Item") aparece cortado en el borde izquierdo.
- No incluye: fondo, altura de layout, lista lateral "1. 2. 3.", plantillas de estilo, palabras resaltadas, color de contorno ni cursiva.

### 3.7 Perfil
| Elemento | Estado |
|---|---|
| Editar nombre, handle y bio | Funciona y se persiste 👁 |
| Avatar (4 emojis predefinidos) | Funciona 👁 |
| Idioma | Funciona ✔ (duplicado del selector de la barra lateral) |
| Plataforma por defecto, estilo de subtítulo por defecto, color de acento, auto-mayúsculas | Se guardan, pero **ningún otro componente los usa** (grep en `App.tsx`: sin referencias) → preferencias sin efecto |
| Métricas "Clips Saved 12", "AI Prompts 45", "Est. View Reach 1.2M", hito "1.2M / 1.0M" | **Datos ficticios** fijados en `DEFAULT_PROFILE` y en `ProfileView.tsx:250`. Se presentan como métricas reales |
| "Viral Checklist" | Los 4 ítems están marcados como completados de forma fija |
| Panel de color de acento | Bug de estilos: `className` usa comillas dobles con `${isDarkMode…}` dentro (`ProfileView.tsx:432`), así que la interpolación no se evalúa y el tema no se aplica |

### 3.8 Inteligencia artificial
`generateRankingScript(topic)` (`services/geminiService.ts`) está implementada con el modelo `gemini-3-flash-preview` y un esquema JSON. **No hay ningún punto de la UI que la llame.** El botón "AI" de la barra no tiene handler. La métrica "AI Prompts" es ficticia. **Estado: no integrada.**

## 4. Formularios y validaciones

| Formulario | Validación cliente | Validación servidor |
|---|---|---|
| Título principal | `maxLength=32` | **Ninguna** (el backend acepta cualquier longitud y contenido) |
| Título de clip | Ninguna | Ninguna |
| Trim (inputs) | `parseFloat \|\| 0` | `startTime < endTime` en `/api/export` |
| Subida | `file.type === 'video/mp4'` | Extensión `.mp4`, ≤ 200 MB y `ffprobe` (validación laxa, ver 07) |
| URL | `startsWith('http')` | `new URL()` y `hostname.includes(...)` (eludible, ver 07) |
| Perfil | Valores por defecto si están vacíos | — |

## 5. Integraciones externas

| Servicio | Uso | Estado |
|---|---|---|
| YouTube / TikTok / Instagram (vía yt-dlp) | Descarga de clips | Funciona según el PLAN. YouTube baja en **360p** (`-f best[ext=mp4]` elige el formato progresivo combinado; verificado: `*_youtube.mp4` = 360×640) |
| Google Cloud Storage (BigBuckBunny) | Video del proyecto de ejemplo | **Roto**: HEAD devuelve **403** y `<video>` da error 4 (verificado) |
| Gemini | Generación de rankings | No integrado |
| Tailwind CDN, Google Fonts | Estilos | Funciona. No apto para producción |

## 6. Elementos que no existen

Autenticación, roles, panel de administración, base de datos, webhooks, automatizaciones, notificaciones, pagos y almacenamiento en la nube.
