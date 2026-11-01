# Viral Ranker AI Server

Backend server para Viral Ranker AI, construido con Express y TypeScript.

## Prerequisitos

Antes de ejecutar el servidor, asegúrate de tener instalados:

- **Node.js** (v18 o superior)
- **ffmpeg** — verificar con `ffmpeg -version`
- **yt-dlp** — verificar con `yt-dlp --version`

Si alguno no está disponible, instálalos según tu sistema operativo:

### Windows (usando Chocolatey)
```bash
choco install ffmpeg
choco install yt-dlp
```

### macOS (usando Homebrew)
```bash
brew install ffmpeg
brew install yt-dlp
```

### Linux (Debian/Ubuntu)
```bash
sudo apt-get install ffmpeg python3-pip
pip install yt-dlp
```

### YouTube: runtime de JavaScript para yt-dlp

YouTube exige resolver un challenge de JavaScript. yt-dlp necesita para ello un runtime de JS (`deno`, que es el recomendado, o `node`) y los scripts del solver: el paquete oficial `yt-dlp-ejs`, o `--remote-components ejs:github`. Sin ellos, yt-dlp muestra el aviso `n challenge solving failed` y oculta parte de los formatos. Muchos vídeos se siguen descargando, pero algunos fallan con el mensaje *"YouTube download needs a JavaScript challenge solver"*. Detalles: https://github.com/yt-dlp/yt-dlp/wiki/EJS

## Instalación

1. Ve a la carpeta del servidor:
```bash
cd server
```

2. Instala las dependencias:
```bash
npm install
```

3. Copia el archivo `.env.example` a `.env` (opcional, ya existen valores por defecto):
```bash
cp .env.example .env
```

## Desarrollo

Para levantar el servidor en modo desarrollo con hot-reload:

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3001`.

## Build y ejecución en producción

Para compilar TypeScript a JavaScript:

```bash
npm run build
```

Para ejecutar el servidor compilado (`npm start` recompila antes con `prestart`):

```bash
npm start
```

## Tests

```bash
npm test
```

Arrancan un servidor real en un puerto aleatorio con un `STORAGE_DIR` temporal, así que no tocan `storage/`. Los vídeos de prueba se generan con ffmpeg. Requisitos: ffmpeg y ffprobe en el PATH.

## Endpoints disponibles

- `GET /api/health` — Verifica que el servidor esté funcionando
  - Respuesta: `{ status: "ok" }`

## Variables de entorno

Edita `.env` para personalizar:

| Variable | Valor por defecto | Descripción |
|----------|-------------------|-------------|
| `PORT` | `3001` | Puerto en el que escucha el servidor |
| `HOST` | `127.0.0.1` | Interfaz en la que escucha (solo local por defecto) |
| `STORAGE_DIR` | `server/storage` | Carpeta de uploads, temporales y exports |
| `FONT_FILE` | Inter incluida (`assets/fonts`) | Fuente `.ttf`/`.otf` de los títulos del export; si se define, se usa para todos los estilos |
| `FRONTEND_URL` | `http://localhost:3000` | URL del frontend para CORS |
| `NODE_ENV` | `development` | Entorno (development/production) |

## Verificación rápida

Una vez que el servidor esté corriendo, prueba el endpoint de salud:

```bash
curl http://localhost:3001/api/health
```

Deberías recibir:
```json
{ "status": "ok" }
```
