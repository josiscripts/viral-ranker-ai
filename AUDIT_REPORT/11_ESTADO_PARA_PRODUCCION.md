# 11 — Estado para producción

## Veredicto

**NO apto para producción.** Hoy es un prototipo funcional de uso local para un solo usuario. Hay bloqueantes de seguridad (ejecución remota de código y lectura arbitraria de archivos), de despliegue (URLs fijas, build obsoleto, binarios no aprovisionados) y de calidad del entregable principal (el video exportado no corresponde con la preview).

## 1. Estado por módulo

No se da un porcentaje global. Por módulo se indica la fracción de **criterios de aceptación del PLAN.md que se cumplen de verdad**, según la evidencia de esta auditoría.

| Módulo / Fase | Criterios del PLAN | Cumplidos realmente | Comentario |
|---|---|---|---|
| Fase 0: Backend base | 5 | 4/5 | El criterio "levanta con un comando" se cumple en dev, pero `npm start` ejecuta un `dist` obsoleto |
| Fase 1: Título principal | 5 | 4/5 (sin verificar en táctil) | Falta soporte táctil; el arrastre en mobile real no funciona |
| Fase 2: Subida de MP4 | 5 | 4/5 | La validación de formato es laxa (S-09). Persistencia OK |
| Fase 3: Descarga | 7 | 5/7 | Disparo por tecla. YouTube a 360p. "Progreso real": solo un spinner |
| Fase 4: 10 clips + trim | 6 | 5/6 | La preview no respeta el trim durante la reproducción; inputs sin validar |
| Fase 5: Título por clip | 5 | 4/5 | Falla tras cambiar de proyecto (E-09) |
| Fase 6: Exportación | 7 | **3/7** | ✔ orden (con la salvedad de E-12), ✔ trim, ✔ MP4 válido con fuentes homogéneas. ✘ posición del título principal, ✘ posición del título del clip, ✘ mensaje de error, ✘ progreso real |
| Seguridad | — | — | 5 hallazgos críticos abiertos |
| Tests / CI | — | 0 | Inexistentes |
| Despliegue | — | 0 | Inexistente |

## 2. Respuestas a las preguntas de la fase 9

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | ¿Qué partes están terminadas? | UI de navegación, gestión local de proyectos (salvo borrar el último), edición de título y clips, trim por timeline, perfil básico, health y streaming |
| 2 | ¿Qué funciona realmente? | Verificado: arranque, compilación, Home, Editor, endpoints de validación, generación de MP4 reproducible con fuentes homogéneas |
| 3 | ¿Qué tiene errores? | Exportación (fidelidad, errores invisibles), entrada de URL, borrado de proyectos, rangos, preview del trim, estado tras cambiar de proyecto |
| 4 | ¿Qué está incompleto? | Estilos en el export, reordenar clips, preferencias, IA, Quick Export, barra de formato |
| 5 | ¿Qué componentes faltan? | Cola de jobs, cliente API, configuración por entorno, Error Boundary, tests, linter, autenticación, base de datos (si multiusuario), almacenamiento de objetos, contenedor |
| 6 | ¿Qué integraciones necesitan configuración? | Gemini (clave en el servidor), ffmpeg y yt-dlp en el entorno de despliegue, fuente para `drawtext` |
| 7 | ¿Qué impide el despliegue? | Ver §3 |
| 8 | ¿Qué riesgos de seguridad existen? | RCE ×3, path traversal, SSRF, sin autenticación, DoS, PII en el bundle (ver 07) |
| 9 | ¿Qué mejoras técnicas son necesarias? | Separar `App.tsx`, `spawn` con argumentos, coordenadas normalizadas, cola, tests, Tailwind compilado, documentación al día |
| 10 | ¿Qué hay que hacer para terminar? | Ejecutar el roadmap de `12_PLAN_DE_DESARROLLO.md` en orden P0 → P4 |

## 3. Bloqueantes de despliegue (checklist)

| # | Bloqueante | Ref. | Estado |
|---|---|---|---|
| B-1 | Inyección de comandos en download, upload y export | S-01, S-02, S-03 | ❌ |
| B-2 | Path traversal en `/api/exports` | S-04 | ❌ |
| B-3 | SSRF y lectura local en export | S-05 | ❌ |
| B-4 | Sin autenticación ni límites (si será público) | S-06, S-07 | ❌ |
| B-5 | URL del backend fija en el código; URLs absolutas guardadas en los proyectos | E-14 | ❌ |
| B-6 | `npm start` ejecuta un build obsoleto | E-08 | ❌ |
| B-7 | ffmpeg, yt-dlp y fuentes no aprovisionados (sin Dockerfile) | 02 §3 | ❌ |
| B-8 | Tailwind por CDN (no recomendado para producción) | 08 §12 | ❌ |
| B-9 | `execSync` bloqueante (un usuario descargando bloquea a todos) | E-16 | ❌ |
| B-10 | Almacenamiento local sin limpieza ni cuotas | E-31 | ❌ |
| B-11 | Jobs en memoria (no escalan ni sobreviven a reinicios) | E-17 | ❌ |
| B-12 | Export inconsistente con la preview | E-03, E-04, E-06 | ❌ |
| B-13 | Aviso legal y términos para descargas de terceros | S-14 | ❌ |
| B-14 | PII del autor en el bundle | S-10 | ❌ |
| B-15 | Sin tests ni CI | 09 | ❌ |

## 4. Decisiones pendientes que te corresponden

Ningún documento del proyecto las resuelve. Según CLAUDE.md §5.3, deben consultarse antes de implementar:

1. **Fidelidad del export:** ¿qué elementos de la preview deben quedar incrustados en el video (fondo, altura de layout, lista lateral de rankings, presets de estilo, palabras resaltadas, color de contorno, cursiva)? Define el alcance de P1-04.
2. **Modelo de uso:** ¿herramienta local de un solo usuario o servicio web multiusuario? Determina autenticación, base de datos y almacenamiento.
3. **Cola de trabajos:** ¿qué librería? (en proceso como p-queue, o BullMQ con Redis).
4. **Destino de despliegue:** VPS/Docker, PaaS… ffmpeg y yt-dlp requieren un contenedor o una VM; no sirven las plataformas serverless puras.
5. **Postura legal** sobre descargar contenido de plataformas de terceros.
6. **IA:** ¿se integra en esta versión? (el PLAN la deja como "fase aparte").
7. **Quick Export y barra de formato:** ¿implementar o retirar?
