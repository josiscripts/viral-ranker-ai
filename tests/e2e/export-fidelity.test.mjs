// P1-04: the exported video shows the design elements of the preview (title style
// and highlighted words, clip title box, rank list, video shading), not plain text.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { startStack, openApp, makeTempDir, makeVideoFixture, uploadFixture, makeProject, makeClip, API_URL } from './helpers.mjs';

const [WIDTH, HEIGHT] = [1080, 1920];
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

// Green background, video in the middle 40 %. QUICK main title (white, red accent on
// the highlighted word), BLUE_BOX clip title and rank number.
const styledProject = () => makeProject(
  [makeClip('clip_a', 1, {
    url: `/api/files/${asset}`, assetId: asset, duration: 2, title: 'CLIP TITLE',
    titleStyleId: 'BLUE_BOX', rankStyleId: 'BLUE_BOX', clipTitlePosition: { fx: 0.5, fy: 0.88 }
  })],
  // No stroke: with the default 2 px the black outline covers most of the 16 px letters
  { title: 'TOP RANKING', captionStyle: 'QUICK', highlightedIndices: [1], titleStroke: 0, titlePosition: { fx: 0.5, fy: 0.08 }, background: '#00ff00', videoHeight: 40 }
);

const isBlueBox = (r, g, b) => r < 90 && g > 70 && g < 140 && b > 200; // bg-blue-600
const isAccentRed = (r, g, b) => r > 200 && g < 120 && b < 120; // text-red-500

// Share of pixels matching `match` inside a box given in fractions of the frame
const coverage = (frame, box, match) => {
  let hits = 0;
  let total = 0;
  for (let y = Math.round(box.top * HEIGHT); y < Math.round(box.bottom * HEIGHT); y++) {
    for (let x = Math.round(box.left * WIDTH); x < Math.round(box.right * WIDTH); x++) {
      const i = (y * WIDTH + x) * 3;
      total++;
      if (match(frame[i], frame[i + 1], frame[i + 2])) hits++;
    }
  }
  return hits / total;
};

// Boxes of the preview elements, as fractions of the canvas
const measureElements = page => page.evaluate(() => {
  const canvas = document.querySelector('div[class*="aspect-[9/16]"]').getBoundingClientRect();
  const box = element => {
    const r = element.getBoundingClientRect();
    return { left: (r.left - canvas.left) / canvas.width, right: (r.right - canvas.left) / canvas.width, top: (r.top - canvas.top) / canvas.height, bottom: (r.bottom - canvas.top) / canvas.height };
  };
  const [mainTitle, clipTitle] = [...document.querySelectorAll('div.absolute.w-max')];
  const highlighted = [...mainTitle.lastElementChild.querySelectorAll('span')].find(span => span.textContent === 'RANKING');
  const rankNumber = [...document.querySelectorAll('span')].find(span => span.textContent === '1.');
  return { highlighted: box(highlighted), clipTitle: box(clipTitle.firstElementChild), rankNumber: box(rankNumber) };
});

test('the exported frame shows the styled titles and the rank list of the preview', async t => {
  const { browser, page, consoleErrors } = await openApp({ projects: [styledProject()], viewport: { width: 1440, height: 900 } });
  let elements;
  let jobId;
  try {
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    await page.waitForTimeout(800);
    elements = await measureElements(page);
    const [response] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/export'), { timeout: 60000 }),
      page.getByRole('button', { name: 'EXPORT', exact: true }).click()
    ]);
    jobId = (await response.json()).jobId;
    assert.deepEqual(consoleErrors, []);
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
  const video = path.join(fixturesDir, 'styled.mp4');
  fs.writeFileSync(video, Buffer.from(await (await fetch(`${API_URL}${job.downloadUrl}`)).arrayBuffer()));
  const frame = execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-ss', '0.5', '-i', video, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { maxBuffer: 16 * 1024 * 1024, windowsHide: true });

  const results = {
    highlightedWordRed: coverage(frame, elements.highlighted, isAccentRed),
    clipTitleBlueBox: coverage(frame, elements.clipTitle, isBlueBox),
    rankNumberBlueBox: coverage(frame, elements.rankNumber, isBlueBox)
  };
  t.diagnostic(JSON.stringify(results));
  assert.ok(results.highlightedWordRed > 0.1, 'highlighted word is not in the accent color');
  assert.ok(results.clipTitleBlueBox > 0.5, 'clip title has no blue box');
  assert.ok(results.rankNumberBlueBox > 0.3, 'rank list is missing');
});

test('each clip of the export gets its own design layer', async () => {
  const clipAt = (id, rank, titleStyleId) => makeClip(id, rank, {
    url: `/api/files/${asset}`, assetId: asset, duration: 2, endTime: 1, title: `CLIP ${rank}`,
    titleStyleId, clipTitlePosition: { fx: 0.5, fy: 0.88 }
  });
  const project = makeProject([clipAt('clip_a', 1, 'BLUE_BOX'), clipAt('clip_b', 2, 'ALERT')], { background: '#00ff00', videoHeight: 40 });
  const { browser, page } = await openApp({ projects: [project], viewport: { width: 1440, height: 900 } });
  let jobId;
  try {
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    const [response] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/export'), { timeout: 60000 }),
      page.getByRole('button', { name: 'EXPORT', exact: true }).click()
    ]);
    jobId = (await response.json()).jobId;
    // The preview goes back to the clip that was active before the export
    await page.waitForTimeout(300);
    assert.equal(await page.locator('div.absolute.w-max').nth(1).textContent(), 'CLIP 1');
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
  const video = path.join(fixturesDir, 'two-clips.mp4');
  fs.writeFileSync(video, Buffer.from(await (await fetch(`${API_URL}${job.downloadUrl}`)).arrayBuffer()));
  const frameAt = seconds => execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-ss', String(seconds), '-i', video, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { maxBuffer: 16 * 1024 * 1024, windowsHide: true });

  const clipTitleArea = { left: 0.42, right: 0.58, top: 0.87, bottom: 0.89 };
  const isAlertRed = (r, g, b) => r > 180 && g < 70 && b < 70; // bg-red-600
  const [first, second] = [frameAt(0.5), frameAt(1.5)];
  assert.ok(coverage(first, clipTitleArea, isBlueBox) > 0.3, 'clip 1 title box');
  assert.ok(coverage(second, clipTitleArea, isAlertRed) > 0.3, 'clip 2 title box');
  assert.ok(coverage(second, clipTitleArea, isBlueBox) < 0.05, 'clip 2 shows the layer of clip 1');
});
