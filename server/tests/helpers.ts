// Shared helpers for the server tests: a real server process on a random port
// with its own temporary storage (never server/storage), and ffmpeg fixtures.
import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const APP_HEADERS = { 'X-Requested-With': 'viral-ranker' };
const SERVER_ROOT = path.join(__dirname, '..');

export interface TestServer {
  baseUrl: string;
  storageDir: string;
  output: () => string;
  stop: () => Promise<void>;
}

export function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `viral-ranker-${prefix}-`));
}

export async function startServer(env: Record<string, string> = {}): Promise<TestServer> {
  const storageDir = makeTempDir('storage');
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', 'src/index.ts'], {
    cwd: SERVER_ROOT,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', STORAGE_DIR: storageDir, ...env },
    windowsHide: true
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });

  const baseUrl = `http://127.0.0.1:${port}`;
  const stop = async () => {
    if (child.exitCode === null) {
      await new Promise<void>(resolve => {
        child.once('exit', () => resolve());
        child.kill();
      });
    }
    fs.rmSync(storageDir, { recursive: true, force: true });
  };

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return { baseUrl, storageDir, output: () => output, stop };
    } catch {
      // not listening yet
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  await stop();
  throw new Error(`Test server did not start:\n${output}`);
}

// Short H.264/AAC test clip generated with ffmpeg's lavfi sources.
export function makeVideoFixture(
  filePath: string,
  { seconds = 2, width = 640, height = 360, audio = true }: { seconds?: number; width?: number; height?: number; audio?: boolean } = {}
): string {
  const args = ['-hide_banner', '-v', 'error', '-f', 'lavfi', '-i', `testsrc=size=${width}x${height}:rate=30:duration=${seconds}`];
  if (audio) args.push('-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`, '-c:a', 'aac');
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-shortest', '-y', filePath);
  execFileSync('ffmpeg', args, { windowsHide: true });
  return filePath;
}

export interface ProbeResult {
  width: number;
  height: number;
  duration: number;
  hasAudio: boolean;
}

export function probeVideo(filePath: string): ProbeResult {
  const raw = execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', filePath], {
    encoding: 'utf-8',
    windowsHide: true
  });
  const info = JSON.parse(raw) as {
    streams: { codec_type: string; width?: number; height?: number }[];
    format: { duration: string };
  };
  const video = info.streams.find(stream => stream.codec_type === 'video');
  return {
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    duration: Number(info.format.duration),
    hasAudio: info.streams.some(stream => stream.codec_type === 'audio')
  };
}

export async function uploadFile(baseUrl: string, filePath: string, fileName = path.basename(filePath)) {
  const form = new FormData();
  form.append('video', new Blob([fs.readFileSync(filePath)], { type: 'video/mp4' }), fileName);
  const res = await fetch(`${baseUrl}/api/upload`, { method: 'POST', headers: APP_HEADERS, body: form });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

export async function postJson(baseUrl: string, route: string, body: unknown) {
  const res = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { ...APP_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

export async function waitForExport(baseUrl: string, jobId: string, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = (await (await fetch(`${baseUrl}/api/export/${jobId}`)).json()) as Record<string, unknown>;
    if (job.status === 'completed' || job.status === 'error') return job;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`Export ${jobId} did not finish in ${timeoutMs} ms`);
}
