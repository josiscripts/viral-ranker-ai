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

Para ejecutar el servidor compilado:

```bash
npm start
```

## Endpoints disponibles

- `GET /api/health` — Verifica que el servidor esté funcionando
  - Respuesta: `{ status: "ok" }`

## Variables de entorno

Edita `.env` para personalizar:

| Variable | Valor por defecto | Descripción |
|----------|-------------------|-------------|
| `PORT` | `3001` | Puerto en el que escucha el servidor |
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
