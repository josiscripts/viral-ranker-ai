# INFORME MAESTRO — Auditoría técnica, funcional y de seguridad de Viral Ranker AI

**Fecha:** 2026-11-01 · **Base:** `main @ e8ce780` + 3 archivos sin commitear · **Tipo:** auditoría (no se modificó código)

| Documento | Contenido |
|---|---|
| [01_RESUMEN_GENERAL](01_RESUMEN_GENERAL.md) | Veredicto y cifras |
| [02_TECNOLOGIAS_Y_DEPENDENCIAS](02_TECNOLOGIAS_Y_DEPENDENCIAS.md) | Stack, versiones, `npm audit`, variables de entorno, código obsoleto |
| [03_ARQUITECTURA_DEL_SISTEMA](03_ARQUITECTURA_DEL_SISTEMA.md) | Componentes, flujo de datos, persistencia |
| [04_FUNCIONAMIENTO_DE_LA_APLICACION](04_FUNCIONAMIENTO_DE_LA_APLICACION.md) | Flujos reales de punta a punta |
| [05_ERRORES_DETECTADOS](05_ERRORES_DETECTADOS.md) | 40 errores con archivo, línea, causa y solución |
| [06_BACKEND_Y_BASE_DE_DATOS](06_BACKEND_Y_BASE_DE_DATOS.md) | Endpoints, servicios, concurrencia |
| [07_AUDITORIA_DE_SEGURIDAD](07_AUDITORIA_DE_SEGURIDAD.md) | 14 hallazgos de seguridad |
| [08_FRONTEND_Y_EXPERIENCIA_DE_USUARIO](08_FRONTEND_Y_EXPERIENCIA_DE_USUARIO.md) | UI, responsive, a11y, i18n |
| [09_PRUEBAS_Y_RESULTADOS](09_PRUEBAS_Y_RESULTADOS.md) | Comandos ejecutados y resultados |
| [10_FUNCIONALIDADES_INCOMPLETAS](10_FUNCIONALIDADES_INCOMPLETAS.md) | Inventario de 44 funcionalidades |
| [11_ESTADO_PARA_PRODUCCION](11_ESTADO_PARA_PRODUCCION.md) | Bloqueantes y decisiones pendientes |
| [12_PLAN_DE_DESARROLLO](12_PLAN_DE_DESARROLLO.md) | Roadmap P0–P4 |

---

## 1. Qué aplicación tienes

**Viral Ranker AI** es un editor web de videos verticales tipo ranking ("Top 5…"): hasta 10 clips (subidos o descargados de YouTube, TikTok o Instagram) recortados, con un título principal y títulos por clip, exportados a un único `.mp4`.

**Cómo está construida:** SPA en React 19 + Vite 6 + TypeScript, con Tailwind por CDN y estado en `localStorage`, más un backend Express 4 + TypeScript que llama a `ffmpeg`, `ffprobe` y `yt-dlp` por línea de comandos y guarda los archivos en disco local. Sin base de datos, sin autenticación y sin despliegue. Gemini está escrito pero no conectado.

**Cómo funciona:** el navegador guarda los proyectos y llama a `localhost:3001` para subir, descargar y exportar. El export es un job en memoria que recorta cada clip, le dibuja dos textos y concatena; el frontend consulta su estado cada 500 ms y descarga el resultado.

## 2. Estado real en una tabla

| Área | Estado | Comentario |
|---|---|---|
| Compilación (tsc y vite build) | ✅ Verificado | 0 errores |
| Arranque local (front y back) | ✅ Verificado | |
| Navegación y UI | ✅ Funciona | Varios botones decorativos |
| Proyectos (CRUD local) | ⚠️ Con error crítico | Crash al borrar el último proyecto |
| Subida de MP4 | ⚠️ Funciona, inseguro | Validación laxa, RCE en Linux |
| Descarga de enlaces | ⚠️ Funciona, inseguro | RCE, bloquea el servidor, 360p, se dispara al teclear |
| Trim | ⚠️ Parcial | Timeline OK; inputs sin validar; preview sin respetar el rango |
| Exportación | ❌ No cumple la especificación | 360×640, posiciones erróneas, sin estilos, errores invisibles, RCE y SSRF |
| Seguridad | ❌ Crítica | 5 hallazgos críticos, sin autenticación, expuesto en la LAN |
| IA | ❌ No integrada | |
| Perfil | ⚠️ Mock | Métricas ficticias, preferencias sin efecto, datos personales reales en el código |
| Tests / CI / linter | ❌ Inexistentes | |
| Despliegue | ❌ Inexistente | URLs fijas, `dist` obsoleto, binarios sin aprovisionar |

## 3. Inventario de funcionalidades (resumen)

| Estado | Cantidad | Ejemplos |
|---|---|---|
| Terminada y verificada | 2 | Navegación, listado de proyectos |
| Implementada sin verificar | 10 | Crear y renombrar proyecto, añadir clips, subida, streaming, timeline de trim, perfil |
| Parcialmente desarrollada | 10 | Estilos del título, layout, resaltado, idioma, progreso del export, limpieza |
| Con errores | 8 | Borrar proyecto, rangos, descarga, inputs de trim, preview, posición del título del clip, **exportación**, descarga del export |
| Simulada / mock | 3 | Preferencias, métricas, checklist |
| No implementada | 11 | Reordenar, barra de formato, Quick Export, IA, cola, autenticación, BD, despliegue, tests, aviso legal, import/export de proyectos |

Detalle completo en el documento 10 (44 ítems; uno figura como "IS / CE en seguridad").

## 4. Errores principales

| ID | Error | Gravedad | Evidencia |
|---|---|---|---|
| S-01 | Inyección de comandos en `/api/download` (`downloadService.ts:67-70`) | Crítica | Código |
| S-03 | Inyección de comandos y de filtros en `/api/export` (`ffmpegService.ts:39, 77-98`) | Crítica | Código |
| S-04 | Path traversal en `/api/exports/:filename` (`index.ts:35-43`, sin commitear) | Crítica | **Ejecución** |
| S-05 | SSRF y lectura de archivos locales vía ffmpeg (`exportService.ts:157-159`) | Crítica | Código |
| S-02 | Inyección vía nombre de archivo subido (`videoService.ts:86, 49`) | Crítica en Linux | Código |
| E-01 | Pantalla blanca al borrar el último proyecto (`App.tsx:199-209, 293`) | Crítica | Código |
| E-02 | Errores de exportación invisibles (`App.tsx:261`) | Alta | Código |
| E-03 | El export no sale a 1080×1920 (sale a 360×640) | Alta | **ffprobe** |
| E-04 | Posiciones de títulos mal convertidas (preview de 160–181 px frente a los 540 asumidos) | Alta | **Fotograma + medición** |
| E-05 | La descarga se dispara en cada pulsación (`App.tsx:1305`) | Alta | Código |
| E-06 | Concat `-c copy` con fuentes heterogéneas | Alta | Potencial (fuentes verificadas como distintas) |
| E-07 | Títulos con `'`, `%` o salto de línea rompen el export | Alta | Código |
| E-08 | `npm start` ejecuta un `dist` obsoleto sin export | Alta | **Ejecución** |
| E-14 | `http://localhost:3001` fijo en 7 lugares | Alta | **Bundle** |
| E-16 | `execSync` bloquea el servidor hasta 5 min | Alta | Código |
| E-09…E-13 | Estado del clip activo, cierres obsoletos, rangos duplicados, preview sin trim, trim sin validar | Media | Código |

Total: **40 errores** (E-xx) y **14 hallazgos de seguridad** (S-xx). Ver los documentos 05 y 07.

## 5. Riesgos de seguridad

| Riesgo | Nivel | Mitigación (tarea) |
|---|---|---|
| Ejecución remota de código (S-01, S-02, S-03) | Crítico | P0-01, P0-05 |
| Lectura arbitraria de archivos (S-04) | Crítico | P0-02 |
| SSRF y lectura local (S-05, S-08) | Crítico / Alto | P0-03, P1-06 |
| API sin autenticación y expuesta en la LAN (S-06) | Alto | P0-06, P2-08 |
| Denegación de servicio (S-07) | Alto | P0-06, P1-06, P2-01 |
| Clave de IA destinada al cliente (S-11) | Alto (latente) | P2-05 |
| Datos personales en el bundle (S-10) | Medio | P0-07 |
| Dependencias vulnerables (S-13) | Medio | P0-08 |
| Legal: descargas de terceros (S-14) | Medio | P2-09 |

## 6. Qué impide llevarla a producción

1. Las vulnerabilidades críticas (RCE, traversal, SSRF).
2. URLs del backend fijas y guardadas dentro de los proyectos.
3. `npm start` sirve un build viejo y no hay Dockerfile con ffmpeg y yt-dlp.
4. Un export que no corresponde a la preview ni a la resolución objetivo.
5. Procesamiento síncrono, sin cola y sin límites.
6. Almacenamiento local sin limpieza (~824 MB ya acumulados).
7. Ausencia total de tests y CI.
8. Decisiones de producto sin tomar (ver §8).

## 7. Qué desarrollar primero (tareas pendientes, orden recomendado)

| Orden | ID | Tarea | Prioridad | Dificultad |
|---|---|---|---|---|
| 1 | P3-01a | Tests de humo antes de tocar código | P3 (habilitante) | M |
| 2 | P0-01 | Procesos sin shell (`spawn`/`execFile`) | P0 | M |
| 3 | P0-02 | Cerrar el traversal de `/api/exports` | P0 | S |
| 4 | P0-03 | Export solo con `assetId` (anti-SSRF) | P0 | M |
| 5 | P0-05 | `drawtext` con `textfile` y fuente empaquetada | P0 | M |
| 6 | P0-04 | Corregir el crash al borrar + Error Boundary | P0 | S |
| 7 | P0-06 | Escuchar en localhost, rate limit, límites de descarga y diskStorage | P0 | M |
| 8 | P0-07 | Quitar los datos personales | P0 | S |
| 9 | P0-08 | `npm audit fix` en el servidor | P0 | S |
| 10 | P1-01 | Mostrar los errores de export | P1 | S |
| 11 | P1-07 | Cliente API, `VITE_API_URL`, proxy, build del servidor | P1 | M |
| 12 | P1-05 | Entrada de URL robusta | P1 | S |
| 13 | P1-06 | Descargas asíncronas y de mejor calidad | P1 | M |
| 14 | P1-08 | Clip activo y setState funcional | P1 | S |
| 15 | P1-09 | Rangos 1..N y reordenación | P1 | S |
| 16 | P1-10 | Preview fiel al trim y validación | P1 | S |
| 17 | P1-03 | Pipeline 1080×1920 normalizado + progreso real | P1 | L |
| 18 | P1-02 | Coordenadas normalizadas + migración | P1 | M |
| 19 | P1-04 🔶 | Fidelidad visual del export (según tu decisión) | P1 | L–XL |
| 20+ | P2-*, P3-*, P4-* | Cola, limpieza, perfil, IA, táctil, linter, refactor, Tailwind compilado, documentación, Docker, a11y, i18n | P2–P4 | — |

Fichas completas (archivos, solución, dependencias, criterios de aceptación y verificación) en el documento 12.

## 8. Decisiones que necesito de ti antes de implementar

1. **Fidelidad del export:** ¿qué elementos de la preview deben quedar en el video?
2. **Modelo de uso:** ¿local de un solo usuario o servicio web multiusuario (autenticación y BD)?
3. **Cola de trabajos:** ¿qué librería?
4. **Destino de despliegue.**
5. **Postura legal** sobre descargas de terceros.
6. **IA:** ¿se integra ya o queda para después?
7. **Quick Export y barra de formato:** ¿implementar o retirar?

## 9. Hallazgos confirmados frente a hipótesis

| Tipo | Hallazgos |
|---|---|
| Confirmado por ejecución | S-04, E-03, E-04 (medición y fotograma), E-08, E-14 (bundle), E-15, E-22, S-10 (bundle), S-13, resultados de `tsc`/build/audit, endpoints de validación |
| Confirmado por código | S-01, S-02, S-03, S-05, S-08, S-09, S-11, E-01, E-02, E-05, E-07, E-09 a E-13, E-16, E-17, E-19, E-25 a E-27 y el resto de E-xx de gravedad baja |
| Potencial | E-06 (probabilidad alta), E-07 en Windows (salto de línea), E-20, E-29, fuente de `drawtext` en Linux |

## 10. Limitaciones

- Sin ejecución de exploits ni de procesamiento real nuevo (descargas, subidas, exportaciones).
- La prueba de borrado en el navegador fue bloqueada por el sistema de permisos.
- No existe entorno de producción que auditar.
- No se actualizó `PLAN.md`: esta es una auditoría, y cualquier cambio de estado de fases queda a tu aprobación.

> **Esta auditoría no ha modificado el código, la configuración ni las dependencias.** Lo único creado es la carpeta `AUDIT_REPORT/`. Queda a la espera de tu autorización para empezar por la Prioridad 0.

## 11. Actualización 2026-11-01: Prioridad 0 ejecutada

Con tu autorización se implementó P0: 7 de 8 tareas están cerradas y P0-06 queda parcial porque falta el rate limiting. Los cambios no están commiteados. Hay tres hallazgos nuevos:
- E-41: las exportaciones con título ya fallaban antes por la fuente de `drawtext`.
- E-42: falta `@types/react`.
- E-43: yt-dlp necesita `deno` para YouTube.

Estado y verificación por tarea: `12_PLAN_DE_DESARROLLO.md`, "Estado de ejecución de P0". Archivos cambiados: `PLAN.md`, "Auditoría — Prioridad 0".
