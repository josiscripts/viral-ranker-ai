import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        // Fail instead of silently moving to another port: the backend only allows CORS from :3000
        strictPort: true,
        // The app calls the backend same-origin (/api/...); in development Vite forwards it
        proxy: {
          '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:3001' },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
