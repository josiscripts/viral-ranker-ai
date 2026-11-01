// P1-10: the preview plays only the trimmed range (E-10), its progress bar moves
// (E-28), trim inputs cannot hold an invalid range (E-13) and a new source starts
// with a valid trim (E-29, E-30).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startStack, openApp, makeTempDir, makeVideoFixture, uploadFixture, makeProject, makeClip } from './helpers.mjs';

let stack;
let fixturesDir;
let longAsset;
let shortFixture;

before(async () => {
  stack = await startStack();
  fixturesDir = makeTempDir('e2e-fixtures');
  longAsset = (await uploadFixture(makeVideoFixture(path.join(fixturesDir, 'long.mp4'), { seconds: 6 }))).filename;
  shortFixture = makeVideoFixture(path.join(fixturesDir, 'short.mp4'), { seconds: 2 });
});

after(async () => {
  await stack?.stop();
  if (fixturesDir) fs.rmSync(fixturesDir, { recursive: true, force: true });
});

const trimmedClip = (overrides = {}) => makeClip('clip_a', 1, {
  url: `/api/files/${longAsset}`, assetId: longAsset, duration: 6, startTime: 2, endTime: 3, ...overrides
});
const storedClip = page => page.evaluate(() => JSON.parse(localStorage.getItem('viral_ranker_projects'))[0].clips[0]);

test('the preview only plays the trimmed range and its progress bar moves', async () => {
  const { browser, page } = await openApp({ projects: [makeProject([trimmedClip()])] });
  try {
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    const video = page.locator('video[autoplay]').first();
    await video.evaluate(v => new Promise(resolve => (v.readyState >= 1 ? resolve() : v.addEventListener('loadedmetadata', resolve, { once: true }))));
    await page.waitForFunction(() => !document.querySelector('video[autoplay]').paused, null, { timeout: 5000 });

    const samples = [];
    const widths = new Set();
    for (let i = 0; i < 30; i++) {
      samples.push(await video.evaluate(v => v.currentTime));
      widths.add(await page.locator('div.h-1\\.5 > div.bg-blue-500').evaluate(el => el.style.width));
      await page.waitForTimeout(100);
    }
    const outside = samples.filter(t => t < 1.9 || t > 3.3);
    assert.deepEqual(outside, [], `samples: ${samples.map(t => t.toFixed(2)).join(' ')}`);
    assert.ok(widths.size > 3, `progress widths: ${[...widths].join(' ')}`);
  } finally {
    await browser.close();
  }
});

test('trim inputs are clamped to a valid range when committed', async () => {
  const { browser, page } = await openApp({ projects: [makeProject([trimmedClip()])] });
  try {
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    const [startInput, endInput] = [page.locator('input[type="number"]').nth(0), page.locator('input[type="number"]').nth(1)];

    await startInput.fill('9');
    await startInput.press('Enter');
    assert.deepEqual(await storedClip(page).then(c => [c.startTime, c.endTime]), [2.9, 3]);

    await endInput.fill('50');
    await endInput.press('Tab');
    assert.deepEqual(await storedClip(page).then(c => [c.startTime, c.endTime]), [2.9, 6]);

    await startInput.fill('-4');
    await startInput.press('Enter');
    assert.deepEqual(await storedClip(page).then(c => [c.startTime, c.endTime]), [0, 6]);
    assert.equal(await startInput.inputValue(), '0');
  } finally {
    await browser.close();
  }
});

test('a new source resets the trim to a valid range', async () => {
  const { browser, page } = await openApp({ projects: [makeProject([makeClip('clip_a', 1, { startTime: 4, endTime: 5 })])] });
  try {
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles(shortFixture);
    await page.waitForFunction(() => Boolean(JSON.parse(localStorage.getItem('viral_ranker_projects'))[0].clips[0].assetId), null, { timeout: 30000 });
    const clip = await storedClip(page);
    assert.equal(clip.startTime, 0);
    assert.ok(clip.endTime > 1.9 && clip.endTime <= clip.duration, JSON.stringify(clip));
  } finally {
    await browser.close();
  }
});
