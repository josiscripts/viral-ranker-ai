/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Backend origin when it is not served under the same origin (default: same origin, /api proxied by Vite)
  readonly VITE_API_URL?: string;
}
