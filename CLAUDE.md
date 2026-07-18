# CLAUDE.md

Este archivo es la fuente de verdad del proyecto para Claude Code. Se lee al inicio de cada sesión. Las reglas aquí escritas son OBLIGATORIAS, no sugerencias. Si una petición del usuario contradice una regla de este archivo, Claude Code debe avisarlo antes de proceder, no ignorarla en silencio.

## 1. Descripción del proyecto

**Viral Ranker AI** es una aplicación web para creadores de contenido que permite armar videos tipo "ranking" (Top 5, Top 10, etc.) para TikTok, Reels y YouTube Shorts.

Flujo de uso objetivo (usuario ya registrado):
1. El usuario crea un proyecto de ranking y escribe un título principal, que puede posicionar libremente sobre el lienzo del video.
2. Añade hasta 10 clips: subiendo un archivo `.mp4` propio o pegando un link de YouTube, TikTok o Instagram para que el sistema lo descargue automáticamente.
3. Por cada clip define: rango en el ranking, punto de inicio y fin (trim), y un título individual editable con su propio estilo, que aparece solo mientras se reproduce ese clip.
4. Exporta el resultado final como un único archivo `.mp4` ya compuesto (clips recortados, en orden, con los títulos incrustados).

Estado actual: el frontend (UI, edición de proyectos, estilos de texto, perfil) está construido. La descarga real de video, el recorte, la composición de texto sobre video y la exportación final SON FUNCIONALIDADES A IMPLEMENTAR — hoy están simuladas con mocks (`fetchCleanVideoMP4` y `handleExport` en `App.tsx` no hacen procesamiento real). El detalle paso a paso de cómo implementarlas vive en `PLAN.md`, no en este archivo.

## 2. Stack técnico

### Frontend (existente)
- **React 19** + **TypeScript**
- **Vite 6** como bundler y dev server (puerto 3000)
- **Tailwind CSS vía CDN** (`<script src="https://cdn.tailwindcss.com">` en `index.html`) — NO hay `tailwind.config.js` ni build de PostCSS. Todas las clases se escriben inline en JSX.
- **lucide-react** para iconos
- **@google/genai** (SDK de Gemini) para generación de contenido con IA
- Las dependencias de React/lucide-react/@google/genai se cargan por **importmap + esm.sh** en `index.html`, no solo por `node_modules`. Al agregar una dependencia nueva del lado del cliente, hay que decidir explícitamente si se instala por npm, por importmap, o ambas — no asumir.
- Persistencia actual: `localStorage` del navegador (clave `viral_ranker_projects`). No hay backend todavía.
- Variable de entorno: `GEMINI_API_KEY` (se inyecta vía `vite.config.ts` como `process.env.API_KEY` y `process.env.GEMINI_API_KEY`)

### Backend (futuro, a construir según PLAN.md)
- **Node.js + Express** (o Fastify) para exponer endpoints REST
- **ffmpeg** (vía `fluent-ffmpeg` o llamadas directas al binario) para: recortar clips (trim), superponer texto sobre video (drawtext/overlay), concatenar clips en el orden del ranking, y exportar el `.mp4` final
- **yt-dlp** (o equivalente) para descargar video desde links de YouTube/TikTok/Instagram
- Almacenamiento temporal de archivos en disco (o storage en la nube si se define más adelante)
- Cola de trabajos para descargas/exportaciones (no bloquear el servidor mientras procesa) — la librería específica se define en `PLAN.md`, no aquí

No asumir ni agregar librerías de backend que no estén explícitamente acordadas en `PLAN.md` sin antes preguntar.

## 3. Estructura de archivos

```
/
├── App.tsx                 # Componente raíz. Contiene: estado global de proyectos,
│                            # lógica de edición de clips/título, presets de estilo
│                            # (STYLE_PRESETS), export/import de proyectos, y la mayoría
│                            # de las vistas (home, dashboard de proyectos, editor).
│                            # Es el archivo más grande — al editarlo, modificar solo
│                            # la sección relevante, no reescribir el archivo completo.
├── ProfileView.tsx          # Vista de perfil de usuario: datos personales, avatar,
│                            # estadísticas, preferencias por defecto.
├── types.ts                 # Todas las interfaces TypeScript compartidas: Clip,
│                            # CaptionStyle, Project, AIRecommendation, UserProfile.
│                            # Cualquier campo nuevo que necesite un objeto (ej. posición
│                            # de título por clip) se define AQUÍ primero, antes de usarse
│                            # en componentes.
├── translations.ts          # Diccionario de traducciones ES/EN usado en toda la UI.
│                            # Toda cadena de texto visible para el usuario debe pasar
│                            # por este sistema, no hardcodearse solo en un idioma.
├── services/
│   └── geminiService.ts     # Única capa de comunicación con la API de Gemini.
│                            # Cualquier llamada nueva a IA (generación de títulos,
│                            # sugerencias, etc.) se agrega como función exportada aquí,
│                            # nunca inline dentro de App.tsx.
├── index.tsx                 # Entry point de React (ReactDOM.createRoot)
├── index.html                # HTML base, carga Tailwind CDN, fuentes, importmap
├── vite.config.ts            # Config de Vite, puerto 3000, inyección de env vars
├── tsconfig.json             # Config de TypeScript, alias @ apunta a la raíz del repo
├── metadata.json              # Metadata del proyecto (nombre, descripción)
├── package.json
└── CLAUDE.md / PLAN.md        # Este archivo y el plan de trabajo (ver sección 5)
```

### Estructura futura (backend, se crea cuando el PLAN.md lo indique)
```
/server/
├── index.ts                  # Entry point del servidor Express
├── routes/                   # Endpoints (download, upload, export)
├── services/
│   ├── downloadService.ts    # Wrapper de yt-dlp
│   └── ffmpegService.ts      # Wrapper de ffmpeg (trim, overlay, concat)
└── storage/                  # Archivos temporales de video
```
No crear esta carpeta ni sus archivos hasta que `PLAN.md` indique explícitamente ese paso.

## 4. Convenciones de código (ya existentes — respetarlas siempre)

- **Nombres de variables y funciones**: `camelCase` (ej. `handleExport`, `updateCurrentProject`, `activeProjectId`).
- **Nombres de tipos/interfaces**: `PascalCase` (ej. `Clip`, `Project`, `UserProfile`).
- **Nombres de componentes React**: `PascalCase` (ej. `ProfileView`, `App`).
- **Constantes globales de configuración**: `UPPER_SNAKE_CASE` (ej. `STYLE_PRESETS`, `INITIAL_PROJECTS`, `DEFAULT_PROFILE`).
- **Handlers de eventos**: siempre prefijo `handle` (ej. `handleUpdateClip`, `handleDeleteProject`, `handleDragStart`).
- **Estilos**: Tailwind **inline en el JSX**, usando template strings con condicionales del tipo:
  ```tsx
  className={`flex items-center gap-3 ${isDarkMode ? 'bg-black/60 border-white/5' : 'bg-white border-gray-200'}`}
  ```
  No crear archivos `.css` adicionales ni usar `styled-components`/CSS Modules. Toda nueva UI sigue este mismo patrón de clases condicionales por `isDarkMode`.
- **Soporte de tema claro/oscuro**: cualquier componente visual nuevo debe aceptar y respetar `isDarkMode`, siguiendo el mismo patrón condicional que el resto del código.
- **Internacionalización**: cualquier texto visible nuevo debe agregarse a `translations.ts` y consultarse vía la variable `lang`/`t` existente (`lang === 'es' ? '...' : '...'` o la clave correspondiente en `translations`), nunca como string fijo en un solo idioma.
- **Tipado**: todo objeto de datos nuevo (clip, proyecto, perfil, respuesta de IA) se tipa primero en `types.ts`. No usar `any` salvo excepción justificada explícitamente en el código con comentario.
- **Estado**: se maneja con hooks nativos de React (`useState`, `useEffect`, `useMemo`, `useCallback`). No introducir librerías de manejo de estado (Redux, Zustand, etc.) sin que esté acordado en `PLAN.md`.
- **Persistencia de proyectos**: mientras no exista backend, todo cambio de estado de `projects` debe seguir sincronizándose a `localStorage` tal como ya hace el `useEffect` existente en `App.tsx`.
- **Servicios externos (IA, descarga de video, exportación)**: siempre en un archivo dedicado dentro de `services/`, nunca lógica de fetch/API inline dentro de componentes.
- **Iconos**: se usan exclusivamente de `lucide-react`, ya importados por nombre al inicio de `App.tsx`. Reutilizar el icono ya importado si aplica antes de importar uno nuevo.

## 5. Regla de oro para Claude Code

Este `CLAUDE.md` da el CONTEXTO del proyecto (qué es, con qué stack, cómo está organizado, cómo se escribe el código). El PASO A PASO de qué construir y en qué orden vive en `PLAN.md`. Claude Code debe:

1. Leer y respetar este archivo en cada sesión.
2. Antes de implementar cualquier feature nueva, consultar `PLAN.md` para saber en qué fase del roadmap se está y no adelantarse a fases futuras ni mezclar pasos.
3. Si algo no está claro o no está cubierto por ninguno de los dos archivos, preguntar al usuario antes de asumir o improvisar.
