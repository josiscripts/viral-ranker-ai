// Single layer for every call to the backend (upload, download, export).
// By default requests are same-origin (/api/...): Vite proxies /api to the
// backend in development. VITE_API_URL points the app at another origin.
import { ExportJobStatus, ExportRequest, VideoAssetResponse } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

// Required by the backend on every POST (forces a CORS preflight cross-origin)
const APP_REQUEST_HEADERS = { 'X-Requested-With': 'viral-ranker' };

// The server could not be reached at all (fetch rejected)
export class ApiNetworkError extends Error {}

// The server answered with an error status; message is the server's `error` text
export class ApiResponseError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

// Media URLs returned by the backend (/api/files/...) are stored relative and
// resolved here, so saved projects do not depend on the backend's address.
export const resolveMediaUrl = (url: string) => (url.startsWith('/api/') ? apiUrl(url) : url);

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const isPost = init.method === 'POST';
  try {
    return await fetch(apiUrl(path), {
      ...init,
      headers: isPost ? { ...APP_REQUEST_HEADERS, ...init.headers } : init.headers
    });
  } catch (error) {
    // Timeouts and aborts are the caller's decision, not a network failure
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw error;
    throw new ApiNetworkError(error instanceof Error ? error.message : 'Network error');
  }
}

async function readJson<T>(response: Response): Promise<T> {
  let data: unknown = null;
  try {
    data = await response.json();
  } catch (e) {
    // Body is not JSON; handled below
  }
  if (!response.ok) {
    const message = data && typeof (data as { error?: unknown }).error === 'string'
      ? (data as { error: string }).error
      : `HTTP ${response.status}`;
    throw new ApiResponseError(message, response.status);
  }
  if (data === null) throw new ApiResponseError('Invalid response from server', response.status);
  return data as T;
}

export async function downloadVideoFromUrl(url: string): Promise<VideoAssetResponse> {
  const response = await request('/api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  return readJson<VideoAssetResponse>(response);
}

export async function uploadVideoFile(file: File): Promise<VideoAssetResponse> {
  const formData = new FormData();
  formData.append('video', file);
  const response = await request('/api/upload', { method: 'POST', body: formData });
  return readJson<VideoAssetResponse>(response);
}

// Design layer (transparent PNG) of one clip, referenced by the export request
export async function uploadOverlay(png: Blob): Promise<{ overlayId: string }> {
  const formData = new FormData();
  formData.append('overlay', png, 'overlay.png');
  const response = await request('/api/overlays', { method: 'POST', body: formData });
  return readJson<{ overlayId: string }>(response);
}

export async function createExportJob(payload: ExportRequest): Promise<{ jobId: string }> {
  const response = await request('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return readJson<{ jobId: string }>(response);
}

export async function getExportJobStatus(jobId: string, timeoutMs: number): Promise<ExportJobStatus> {
  const response = await request(`/api/export/${encodeURIComponent(jobId)}`, { signal: AbortSignal.timeout(timeoutMs) });
  return readJson<ExportJobStatus>(response);
}
