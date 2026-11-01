# 10 — Inventario de funcionalidades

## Leyenda de estado
- **TV**: terminada y verificada (en esta auditoría).
- **IS**: implementada, sin verificar en esta auditoría.
- **PD**: parcialmente desarrollada.
- **CE**: con errores.
- **MK**: simulada, mock o datos ficticios.
- **NI**: no implementada.
- **ED**: estado desconocido.

## 1. Inventario

| # | Funcionalidad | Estado | Evidencia | Qué falta para terminarla |
|---|---|---|---|---|
| 1 | Navegación Home, Projects, Editor y Profile | TV | Navegador | Router con URLs (opcional) |
| 2 | Tema claro/oscuro persistente | IS | Código | — (pequeños fallos de estilo, E-24) |
| 3 | Idioma EN/ES persistente | PD | Código | Textos fijos sin traducir (08 §14) y `lang` del `<html>` |
| 4 | Crear proyecto | IS | Código | Aplicar las preferencias del perfil |
| 5 | Listar proyectos | TV | Navegador | `preload="metadata"` en las miniaturas |
| 6 | Renombrar proyecto | IS | Código | Límite de longitud coherente |
| 7 | Eliminar proyecto | **CE** | Código | Corregir el crash con 0 proyectos (E-01) |
| 8 | Export/import de proyectos (descrito en CLAUDE.md) | **NI** | grep | Definir si se quiere; si no, quitarlo de la documentación |
| 9 | Título principal (texto y límite 32) | IS | Código | Validación en el servidor. Corregir el ejemplo de 36 caracteres |
| 10 | Arrastre del título principal con clamping | PD | Código | Soporte táctil y coordenadas normalizadas |
| 11 | Resaltar palabras del título | PD | Código | Incluirlo en el export |
| 12 | Plantillas de estilo del título (9 presets) | PD | Código | Solo preview. No se exportan |
| 13 | Grosor y color de contorno | PD | Código | El color no se persiste ni se exporta |
| 14 | Altura de layout y fondo de lienzo | PD | Código | Solo preview |
| 15 | "Dynamic Captions" (mostrar/ocultar) | PD | Código | No se persiste. Sin efecto en el export |
| 16 | Barra de formato (emoji, B, I, fuentes, AI, alinear, deshacer, rehacer) | **NI** (botones decorativos) | Código | Implementar u ocultar |
| 17 | Añadir clips (máx. 10, contador) | IS | Código | — |
| 18 | Rango de cada clip | **CE** | Código | Renumerar y reordenar (E-12) |
| 19 | Reordenar clips | **NI** | Código | UI y lógica |
| 20 | Subida de `.mp4` | IS (CE en seguridad) | Archivos en `storage` | S-02, S-09, E-19 |
| 21 | Descarga YouTube, TikTok e Instagram | **CE** | Código y archivos | Disparo por tecla (E-05), bloqueo (E-16), 360p, S-01 y S-08 |
| 22 | Streaming de video con Range | IS | Código | Range por sufijo, manejo de errores del stream |
| 23 | Trim con timeline | IS | Código | Soporte táctil |
| 24 | Trim con inputs numéricos | **CE** | Código | Validación (E-13) |
| 25 | Preview respetando el trim | **CE** | Código | Bucle dentro de `[start, end]` (E-10) |
| 26 | Título por clip (texto, mayúsculas/minúsculas, cursiva) | IS | Código | La cursiva no se exporta |
| 27 | Posición del título por clip | **CE** | Código | E-09 y coordenadas normalizadas |
| 28 | Lista lateral de rankings en la preview | PD | Código | No se exporta |
| 29 | Exportación a MP4 | **CE** | ffprobe y fotograma | E-02, E-03, E-04, E-06, E-07, S-03, S-05 |
| 30 | Progreso de exportación | PD | Código | Progreso real de ffmpeg y paso actual visible |
| 31 | Descarga del archivo exportado | **CE** | curl | S-04. Nombre de archivo (E-37) |
| 32 | Limpieza de jobs y exports | PD | Código y disco | Limpieza de uploads y huérfanos tras reinicio |
| 33 | Cola de trabajos | **NI** | Código | Decisión de librería (CLAUDE.md) |
| 34 | "Quick Export" | **NI** | `App.tsx:876` | Definir (el PLAN la deja como opcional) |
| 35 | Generación de rankings con IA (Gemini) | **NI** en la UI (servicio escrito, no conectado) | grep | Endpoint en el backend, UI y aplicar el resultado a los clips |
| 36 | Perfil: editar identidad y avatar | IS | Código | — |
| 37 | Perfil: preferencias | **MK** (sin efecto) | grep | Conectarlas o eliminarlas |
| 38 | Perfil: métricas e hitos | **MK** | Código | Calcularlas con datos reales o eliminarlas |
| 39 | "Viral Checklist" | **MK** (siempre marcada) | Código | Interactiva o estática sin checks |
| 40 | Autenticación, usuarios y roles | **NI** | — | Decisión de producto |
| 41 | Base de datos y persistencia en el servidor | **NI** | — | Decisión de producto |
| 42 | Despliegue (build del servidor, Docker, CI) | **NI** / **CE** (`dist` obsoleto) | Archivos | P1-07, P3-09 |
| 43 | Tests automatizados | **NI** | — | P3-01 |
| 44 | Aviso legal sobre descargas | **NI** | PLAN (deuda) | P2-09 |

## 2. Funciones declaradas y sin uso

| Elemento | Ubicación |
|---|---|
| `generateRankingScript` | `services/geminiService.ts:6` (importado en `App.tsx:57`) |
| `isGenerating` / `setIsGenerating` | `App.tsx:253` |
| `exportJobId` (solo se escribe) | `App.tsx:260` |
| `exportError` (solo se escribe) | `App.tsx:261` |
| `handleMulterError` | `server/src/routes/upload.ts:15` |
| `cleanupJobsManually` | `server/src/services/exportService.ts:247` |
| `getVideoDuration` (ffmpegService, importada sin uso) | `ffmpegService.ts:195`, `exportService.ts` |
| `getClipLayoutConfig().topPosition/containerGap` | `App.tsx:62-96` |
| Tipo `CaptionStyle` (no se aplica a `STYLE_PRESETS`) | `types.ts:17` |
| `Clip.thumbnail`, `Clip.rankStyleId` (sin UI que los asigne) | `types.ts:5, 11` |
| CSS `.neon-glow`, `.canvas-shadow` | `index.html:28, 31` |

## 3. Interfaces sin conexión con el backend
- Botón "AI" y métricas de IA → no hay endpoint de IA.
- Preferencias del perfil → no se usan.
- Estilos visuales del editor → el backend no los recibe ni los renderiza.

## 4. Comentarios TODO y FIXME
No hay comentarios `TODO`, `FIXME` ni `HACK` en el código propio (grep). La deuda está documentada en `PLAN.md` → "Notas / Deuda técnica" (limpieza de uploads, posición del panel de control).

## 5. Descrito en la documentación pero ausente o distinto en el código

| Documento | Afirmación | Realidad |
|---|---|---|
| CLAUDE.md §1 | "`fetchCleanVideoMP4` y `handleExport` … mocks" | `fetchCleanVideoMP4` no existe. `handleExport` es real |
| CLAUDE.md §3 | "export/import de proyectos" en `App.tsx` | No existe |
| CLAUDE.md §2 | "Backend (futuro…)" | El backend existe desde la Fase 0 |
| PLAN Fase 6 | "Resolución: 1080x1920" | Sale a la resolución de origen (360×640) |
| PLAN Fase 6 | "Mapeo de píxeles 540px → 1080px" | La preview no mide 540 px y el anclaje es distinto |
| PLAN Fase 6 | "Si algo falla, el usuario recibe un mensaje de error claro ✅" | El error no se muestra |
| PLAN Fase 6 | "La barra de progreso refleja el avance real ✅" | Avance por pasos |
| PLAN Fase 6 | "Verificación: … lista para testing" pero marcada ✅ | Contradice la regla 2 del PLAN |
| PLAN Fase 1 | "Probado manualmente en desktop y mobile" | El arrastre no soporta eventos táctiles |
| server/README | Endpoints: solo `/api/health` | Hay 7 |
| README raíz | Instrucciones de AI Studio | No menciona el backend, ffmpeg ni yt-dlp |
