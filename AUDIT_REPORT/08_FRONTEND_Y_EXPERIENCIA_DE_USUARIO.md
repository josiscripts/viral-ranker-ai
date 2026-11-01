# 08 — Frontend y experiencia de usuario

**Método:** inspección del código, más ejecución en el navegador integrado (Vite dev en `localhost:3000`, viewports de 1024×768 y 375×812). Solo se hicieron comprobaciones de lectura: DOM, consola y medidas. No se evalúa la estética subjetiva más allá de lo observable.

## 1. Diseño y estructura visual
- Estética oscura "neón" coherente, con modo claro alternativo. La captura existente `debug-page.png` (Home) muestra un layout limpio y legible.
- Bordes muy redondeados, tipografía `font-black uppercase` y degradados, con buena consistencia general.
- Tres sistemas de estilo conviven: utilidades Tailwind inline, CSS en `<style>` de `index.html` (scrollbar, `.neon-glow` y `.canvas-shadow` **sin uso**) y estilos inline (`style={{…}}`). Las clases `scrollbar-dark`/`scrollbar-light` (`App.tsx:1155`) **no están definidas** en ningún sitio.

## 2. Componentes reutilizables
- Solo hay 3 archivos de componentes. `ClipCard`, `ToolCard`, `SidebarItem`, `ToggleRow`, `ToolbarButton` y `ToolbarDropdown` viven dentro de `App.tsx`. `ClipCard` tiene 17 props, varias `any`, y líneas de más de 2.000 caracteres (`App.tsx:1297`, `1305`).
- `STYLE_PRESETS` se duplica parcialmente en `ProfileView.tsx` (`STYLE_PRESET_OPTIONS`, con nombres distintos: "Glow Preset", "Retro Yellow").
- `fontSizeMap` y `spacingMap` están duplicados (`App.tsx:101-112` y `1208-1209`).

## 3. Navegación
- Sin router ni URLs por vista. No hay deep links y el botón atrás no funciona. Al recargar se vuelve siempre a Home.
- "Editor" en la barra lateral abre el proyecto activo. Funciona, pero la etiqueta de traducción es `t.library` (`App.tsx:794`), un nombre engañoso.

## 4. Responsive (medido)

| Viewport | Observación |
|---|---|
| 1024×768 | La preview 9:16 queda con un interior de **160×306 px**, muy pequeña para editar posiciones con precisión |
| 375×812 | Barra lateral fija de 80 px, contenido de 295 px y preview de **181×344 px**. Sin scroll horizontal (`scrollWidth = 375`). Las etiquetas de la barra se ocultan (iconos sin texto ni `aria-label`) |
| Táctil | El arrastre de títulos y los handles del trim usan **solo eventos de ratón** (`onMouseDown`, `mousemove`): **no funcionan en pantallas táctiles** (CC). PLAN Fase 1 dice "probado en mobile", pero el script usaba un viewport móvil con ratón, no táctil |

`body { overflow: hidden }` (`index.html`) combinado con `h-screen` obliga a que todo el scroll ocurra dentro de `<main>`. En móvil el editor y la preview se apilan con `p-10` (40 px de padding en una pantalla de 375 px).

## 5. Accesibilidad
| Aspecto | Hallazgo | Evidencia |
|---|---|---|
| Nombres accesibles | **16 botones** solo con icono, sin texto, `aria-label` ni `title` | CE (conteo en el DOM) |
| Toggles | `ToggleRow` es un `<button>` sin `role="switch"` ni `aria-checked` | CC |
| Foco | `focus:ring-0` en inputs y textareas elimina el indicador de foco | CC |
| Idioma | `<html lang="en">` fijo aunque la UI esté en español | CE |
| Contraste | Etiquetas `text-gray-700` sobre `#0c0c0c` en modo oscuro (`App.tsx:1315, 1319`) y textos de 7–9 px (`text-[7px]`, `text-[8px]`) | CC |
| Labels | Inputs de trim sin `<label htmlFor>`; título de clip sin label | CC |
| Movimiento | `animate-bounce` y `animate-pulse` permanentes sin `prefers-reduced-motion` | CC |
| Diálogos | `window.confirm` nativo para borrar. Accesible, pero no estilizado | CC |

## 6. Estados de carga
- Upload y descarga: spinner `Loader2` en el input ✔.
- Export: overlay a pantalla completa con barra ✔. Sin botón de cancelar y sin indicar el paso actual (`currentStep` se recibe pero no se muestra). Texto "Encoding..." fijo en inglés (`App.tsx:775`).
- No hay skeletons. Las miniaturas `<video>` cargan sin placeholder.

## 7. Estados de error
| Situación | Lo que ve el usuario |
|---|---|
| Fallo de upload o descarga | Texto rojo bajo el input ✔. Mensajes del servidor **solo en inglés** |
| Fallo de export | **Nada** (E-02) |
| Video de origen roto (403) | Miniatura negra sin mensaje (CE con el proyecto de ejemplo) |
| Error de render | Pantalla en blanco, sin Error Boundary (E-01, E-38) |
| Backend apagado | Upload y descarga muestran "Failed to fetch". El export no muestra nada |

## 8. Formularios y botones
- Botones sin acción: 11 en la barra de formato y la tarjeta "Quick Export" (E-25).
- El botón EXPORT no se deshabilita sin clips o con clips sin video. Tampoco hay validación previa que explique qué falta.
- El input de URL dispara descargas mientras se escribe (E-05).
- Inputs de trim sin límites (E-13).

## 9. Modales y menús
- El menú contextual del clip se cierra con un clic global ✔. No responde a Escape ni gestiona el foco.
- El selector de avatar es un desplegable inline ✔.

## 10. Animaciones
Clases `animate-in fade-in …` (`App.tsx:864, 882, 997`; `ProfileView`) requieren el plugin `tailwindcss-animate`, que **no está cargado**: el CDN no lo incluye. Esas animaciones **no se ejecutan** (CC).

## 11. Gestión de estado
- Todo el estado está en `App` (más de 25 `useState`). Cada tecla en un título re-renderiza toda la app, incluidas hasta 10 `ClipCard` con `<video>`.
- Cierres obsoletos en operaciones asíncronas (E-11).
- `activeClipId` desincronizado entre proyectos (E-09).
- Escritura en `localStorage` en cada cambio, incluido cada `mousemove` (E-32).
- `strokeColor` y `showCaptions` no se persisten. Parecen propiedades del proyecto, pero son globales y volátiles.

## 12. Medios, imágenes y rendimiento
- Cada `ClipCard` y cada tarjeta de proyecto montan un `<video src>` completo **sin `preload="metadata"`**: con 10 clips y varios proyectos, el navegador puede iniciar decenas de descargas de video.
- Tailwind CDN compila las clases en tiempo de ejecución en el navegador (aviso en consola, CE): coste de CPU en cada carga y sin purga.
- Bundle de producción: 298 kB (86 kB gzip). Aceptable.
- Fuente Inter cargada desde Google sin `preconnect`.

## 13. SEO
SPA sin `meta description` (CE), sin Open Graph ni favicon propio. `<title>` fijo. Es relevante solo si habrá una landing pública. Para un editor autenticado es de baja prioridad.

## 14. Internacionalización
CLAUDE.md exige que todo texto visible pase por el sistema de traducción. Textos fijos en un solo idioma detectados:

| Texto | Ubicación |
|---|---|
| "Encoding..." | `App.tsx:775` |
| "Trim Timeline", "Trim:" | `TrimTimeline.tsx:266, 346` |
| "Switch to Light Mode", "Switch to Night Mode" (title) | `App.tsx:804` |
| "This creator hasn't written a bio yet.", "Change creator avatar style", placeholders | `ProfileView.tsx` |
| Mensajes de error del cliente y del servidor ("Only .mp4 files are allowed", "Unsupported platform…") | `App.tsx:410`, backend |
| "Open Tool" en `ToolCard` | `App.tsx:1257` (falta pasar `lang`) |
| Nombres de los presets de estilo | `STYLE_PRESETS` |

## 15. Elementos incompletos o desconectados

| Elemento | Estado |
|---|---|
| Barra de formato del título (11 botones) | Sin funcionalidad |
| Quick Export | Sin funcionalidad |
| Botón "AI" | Sin funcionalidad. Gemini no está integrado |
| Preferencias del perfil | Se guardan, sin efecto |
| Métricas del perfil | Ficticias |
| Preview, comparada con el video exportado | No coinciden: fondo, layout, lista de rankings, estilos, resaltado, posiciones |
| Reordenar clips | No existe (iconos importados sin uso) |
| Barra de progreso de reproducción | Estática |
