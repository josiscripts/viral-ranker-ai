// P1-07: the app talks to the backend only through same-origin /api (Vite proxy),
// stores relative media URLs, and migrates projects saved with absolute URLs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startStack, openApp, makeTempDir, makeVideoFixture, uploadFixture, makeProject, makeClip } from './helpers.mjs';

let stack;
let fixturesDir;
let fixturePath;
let asset;

before(async () => {
  stack = await startStack();
  fixturesDir = makeTempDir('e2e-fixtures');
  fixturePath = makeVideoFixture(path.join(fixturesDir, 'clip.mp4'));
  asset = (await uploadFixture(fixturePath)).filename;
});

after(async () => {
  await stack?.stop();
  if (fixturesDir) fs.rmSync(fixturesDir, { recursive: true, force: true });
});

const readStoredClips = page => page.evaluate(() => JSON.parse(localStorage.getItem('viral_ranker_projects'))[0].clips);

test('projects saved with absolute backend URLs are migrated and still play', async () => {
  const legacyClip = makeClip('clip_a', 1, { url: `http://localhost:3001/api/files/${asset}`, duration: 2 });
  const { browser, page, consoleErrors } = await openApp({ projects: [makeProject([legacyClip])] });
  try {
    const [clip] = await readStoredClips(page);
    assert.equal(clip.url, `/api/files/${asset}`);
    assert.equal(clip.assetId, asset);

    const media = page.waitForResponse(res => res.url() === `http://localhost:3000/api/files/${asset}`);
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    assert.ok([200, 206].includes((await media).status()));
    assert.deepEqual(consoleErrors, []);
  } finally {
    await browser.close();
  }
});

test('upload and export go through same-origin /api only', async () => {
  const { browser, page } = await openApp({ projects: [makeProject([makeClip('clip_a', 1)])] });
  const requestedUrls = [];
  page.on('request', request => requestedUrls.push(request.url()));
  try {
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles(fixturePath);

    await page.waitForFunction(() => {
      const clip = JSON.parse(localStorage.getItem('viral_ranker_projects'))[0].clips[0];
      return Boolean(clip.assetId);
    }, null, { timeout: 30000 });
    const [clip] = await readStoredClips(page);
    assert.match(clip.url, /^\/api\/files\/\d+_clip\.mp4$/);

    const download = page.waitForEvent('download', { timeout: 60000 });
    await page.getByRole('button', { name: 'EXPORT', exact: true }).click();
    await download;

    const apiCalls = requestedUrls.filter(url => url.includes('/api/'));
    assert.ok(apiCalls.some(url => url === 'http://localhost:3000/api/upload'));
    assert.ok(apiCalls.some(url => url === 'http://localhost:3000/api/export'));
    assert.deepEqual(requestedUrls.filter(url => url.includes(':3001')), []);
  } finally {
    await browser.close();
  }
});
