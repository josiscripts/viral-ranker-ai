// End-to-end harness: real backend (temporary storage, never server/storage),
// the Vite dev server and a fresh Chromium profile (never the user's browser data).
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SERVER_DIR = path.join(ROOT, 'server');
export const APP_URL = 'http://localhost:3000';
export const API_URL = 'http://127.0.0.1:3001';
export const APP_HEADERS = { 'X-Requested-With': 'viral-ranker' };

export const makeTempDir = prefix => fs.mkdtempSync(path.join(os.tmpdir(), `viral-ranker-${prefix}-`));

const isPortInUse = port =>
  Promise.all(['127.0.0.1', '::1'].map(host => new Promise(resolve => {
    const socket = net.connect({ port, host });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  }))).then(results => results.some(Boolean));

const waitForUrl = async (url, child, getOutput, timeoutMs = 90_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`${url} did not start:\n${getOutput()}`);
};

const spawnLogged = (args, options) => {
  const child = spawn(process.execPath, args, { ...options, windowsHide: true });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  return { child, output: () => output };
};

const stopChild = child =>
  child.exitCode !== null
    ? Promise.resolve()
    : new Promise(resolve => { child.once('exit', () => resolve()); child.kill(); });

// A Vite dev server already running on :3000 for this repo is reused (and left
// running). The backend always gets its own process, so a running backend on
// :3001 (which uses the real server/storage) is an error instead.
const isThisAppOnPort3000 = async () => {
  try {
    return (await (await fetch(APP_URL)).text()).includes('/index.tsx');
  } catch {
    return false;
  }
};

export async function startStack() {
  if (await isPortInUse(3001)) {
    throw new Error('Port 3001 is in use. Stop the backend before running the e2e tests (they use a temporary storage dir).');
  }
  const reuseVite = await isPortInUse(3000);
  if (reuseVite && !(await isThisAppOnPort3000())) {
    throw new Error('Port 3000 is in use by another application.');
  }
  const storageDir = makeTempDir('e2e-storage');
  const backend = spawnLogged(['-r', 'ts-node/register/transpile-only', 'src/index.ts'], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: '3001', HOST: '127.0.0.1', STORAGE_DIR: storageDir }
  });
  const vite = reuseVite
    ? null
    : spawnLogged([path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', '3000', '--strictPort'], { cwd: ROOT });

  const stop = async () => {
    await Promise.all([stopChild(backend.child), vite && stopChild(vite.child)]);
    fs.rmSync(storageDir, { recursive: true, force: true });
  };
  try {
    await waitForUrl(`${API_URL}/api/health`, backend.child, backend.output);
    if (vite) await waitForUrl(APP_URL, vite.child, vite.output);
  } catch (error) {
    await stop();
    throw error;
  }
  return { storageDir, backendOutput: backend.output, stop };
}

export async function openApp({ projects, lang = 'en' } = {}) {
  // Autoplay with sound is allowed so the preview video plays as it does after a user click
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(String(error)));
  await page.goto(APP_URL);
  await page.evaluate(({ projects, lang }) => {
    localStorage.setItem('viral_ranker_lang', lang);
    if (projects) localStorage.setItem('viral_ranker_projects', JSON.stringify(projects));
  }, { projects, lang });
  await page.reload();
  return { browser, page, consoleErrors };
}

export function makeVideoFixture(filePath, { seconds = 2, width = 640, height = 360 } = {}) {
  execFileSync('ffmpeg', [
    '-hide_banner', '-v', 'error',
    '-f', 'lavfi', '-i', `testsrc=size=${width}x${height}:rate=30:duration=${seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-y', filePath
  ], { windowsHide: true });
  return filePath;
}

export async function uploadFixture(filePath) {
  const form = new FormData();
  form.append('video', new Blob([fs.readFileSync(filePath)], { type: 'video/mp4' }), path.basename(filePath));
  const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', headers: APP_HEADERS, body: form });
  if (!res.ok) throw new Error(`Fixture upload failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export const makeProject = (clips, overrides = {}) => ({
  id: 'proj_e2e',
  title: 'E2E RANKING',
  clips,
  background: '#000000',
  videoHeight: 70,
  captionStyle: 'BLUE_BOX',
  enableTitleDrag: false,
  titleStroke: 2,
  titlePosition: { x: 0, y: -220 },
  highlightedIndices: [],
  ...overrides
});

export const makeClip = (id, rank, overrides = {}) => ({
  id,
  url: '',
  startTime: 0,
  endTime: 1,
  rank,
  title: `Clip ${rank}`,
  titleStyleId: 'BLUE_BOX',
  ...overrides
});
