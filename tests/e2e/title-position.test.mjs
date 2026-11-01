// P1-02: title positions are fractions of the canvas (E-04). Old pixel offsets are
// migrated, the preview keeps the same proportions at any window size, and the
// exported frame puts the titles where the preview shows them (±2 % of the canvas).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { startStack, openApp, makeTempDir, makeVideoFixture, uploadFixture, makeProject, makeClip, API_URL } from './helpers.mjs';

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1100, height: 800 },
  { width: 800, height: 900 }
];
const TOLERANCE = 0.02;

let stack;
let fixturesDir;
let asset;

before(async () => {
  stack = await startStack();
  fixturesDir = makeTempDir('e2e-fixtures');
  asset = (await uploadFixture(makeVideoFixture(path.join(fixturesDir, 'clip.mp4')))).filename;
});

after(async () => {
  await stack?.stop();
  if (fixturesDir) fs.rmSync(fixturesDir, { recursive: true, force: true });
});

// Titles away from the video area (40 % of the height, centered), over a red background
const positionedProject = () => makeProject(
  [makeClip('clip_a', 1, { url: `/api/files/${asset}`, assetId: asset, duration: 2, title: 'CLIP TITLE', clipTitlePosition: { fx: 0.7, fy: 0.85 } })],
  { title: 'MAIN TITLE', titlePosition: { fx: 0.35, fy: 0.15 }, background: '#ff0000', videoHeight: 40 }
);

// Center of each title and its height, as fractions of the canvas
const measurePreview = page => page.evaluate(() => {
  const canvas = document.querySelector('div.aspect-\\[9\\/16\\]').getBoundingClientRect();
  const measure = element => {
    const box = element.getBoundingClientRect();
    return {
      fx: (box.left + box.width / 2 - canvas.left) / canvas.width,
      fy: (box.top + box.height / 2 - canvas.top) / canvas.height,
      height: box.height / canvas.height
    };
  };
  const [main, clip] = [...document.querySelectorAll('div.absolute.w-max')];
  return { main: measure(main), clip: measure(clip), canvas: { width: canvas.width, height: canvas.height } };
});

const assertClose = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) <= TOLERANCE, `${label}: ${actual.toFixed(4)} vs ${expected.toFixed(4)}`);

test('old pixel offsets are migrated to fractions of the canvas', async () => {
  const legacy = makeProject([makeClip('clip_a', 1, { clipTitlePosition: { x: 108, y: 0 } })], { titlePosition: { x: 0, y: -220 } });
  const { browser, page } = await openApp({ projects: [legacy] });
  try {
    const [stored] = await page.evaluate(() => JSON.parse(localStorage.getItem('viral_ranker_projects')));
    assert.deepEqual(stored.titlePosition, { fx: 0.5, fy: 0.2215 });
    assert.deepEqual(stored.clips[0].clipTitlePosition, { fx: 0.75, fy: 0.5 });
  } finally {
    await browser.close();
  }
});

test('the preview keeps titles in the same place and size at any window size', async t => {
  // The sidebar hides its labels on narrow windows, so the editor is opened once and the window resized
  const { browser, page } = await openApp({ projects: [positionedProject()], viewport: VIEWPORTS[0] });
  const results = [];
  try {
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(300);
      results.push(await measurePreview(page));
    }
  } finally {
    await browser.close();
  }
  const sizes = results.map(r => Math.round(r.canvas.width));
  for (const r of results) t.diagnostic(`canvas ${Math.round(r.canvas.width)}px: main ${r.main.fx.toFixed(3)},${r.main.fy.toFixed(3)} h=${r.main.height.toFixed(4)} clip ${r.clip.fx.toFixed(3)},${r.clip.fy.toFixed(3)}`);
  assert.equal(new Set(sizes).size, VIEWPORTS.length, `canvas widths should differ: ${sizes.join(', ')}`);
  for (const result of results) {
    assertClose(result.main.fx, 0.35, 'main fx');
    assertClose(result.main.fy, 0.15, 'main fy');
    assertClose(result.clip.fx, 0.7, 'clip fx');
    assertClose(result.clip.fy, 0.85, 'clip fy');
    assertClose(result.main.height, results[0].main.height, 'main height');
  }
});

// Bounding box of the white text pixels in rows [top, bottom) of an RGB frame
const whiteBox = (frame, width, top, bottom) => {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -1, -1];
  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      if (frame[i] > 200 && frame[i + 1] > 200 && frame[i + 2] > 200) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  assert.ok(maxX >= 0, `no text found in rows ${top}-${bottom}`);
  return { fx: (minX + maxX) / 2 / width, fy: (minY + maxY) / 2 };
};

test('the exported frame puts the titles where the preview shows them', async t => {
  const { browser, page } = await openApp({ projects: [positionedProject()], viewport: VIEWPORTS[0] });
  let preview;
  let jobId;
  try {
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    await page.waitForTimeout(300);
    preview = await measurePreview(page);
    const [response] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/export')),
      page.getByRole('button', { name: 'EXPORT', exact: true }).click()
    ]);
    jobId = (await response.json()).jobId;
  } finally {
    await browser.close();
  }

  let job;
  for (let i = 0; i < 300; i++) {
    job = await (await fetch(`${API_URL}/api/export/${jobId}`)).json();
    if (job.status === 'completed' || job.status === 'error') break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.equal(job.status, 'completed', job.error);
  const video = path.join(fixturesDir, 'export.mp4');
  fs.writeFileSync(video, Buffer.from(await (await fetch(`${API_URL}${job.downloadUrl}`)).arrayBuffer()));

  const [width, height] = [1080, 1920];
  const frame = execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-ss', '0.5', '-i', video, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  // The video covers rows 0.3H-0.7H; the main title is above it and the clip title below
  const main = whiteBox(frame, width, 0, Math.round(height * 0.3));
  const clip = whiteBox(frame, width, Math.round(height * 0.7), height);

  t.diagnostic(`preview main ${preview.main.fx.toFixed(3)},${preview.main.fy.toFixed(3)} clip ${preview.clip.fx.toFixed(3)},${preview.clip.fy.toFixed(3)}`);
  t.diagnostic(`export  main ${main.fx.toFixed(3)},${(main.fy / height).toFixed(3)} clip ${clip.fx.toFixed(3)},${(clip.fy / height).toFixed(3)}`);
  assertClose(main.fx, preview.main.fx, 'main fx');
  assertClose(main.fy / height, preview.main.fy, 'main fy');
  assertClose(clip.fx, preview.clip.fx, 'clip fx');
  assertClose(clip.fy / height, preview.clip.fy, 'clip fy');
});
