// P1-05: typing a link must not start downloads; Enter, paste or the button do (E-05).
// /api/download is mocked, so no external site is contacted.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startStack, openApp, makeTempDir, makeVideoFixture, uploadFixture, makeProject, makeClip } from './helpers.mjs';

const LINK = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
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

async function openWithMockedDownload() {
  const app = await openApp({ projects: [makeProject([makeClip('clip_a', 1)])] });
  const downloadRequests = [];
  await app.page.route('**/api/download', async route => {
    downloadRequests.push(route.request().postDataJSON());
    await route.fulfill({ json: { videoUrl: `/api/files/${asset}`, filename: asset, duration: 2, platform: 'youtube' } });
  });
  await app.page.getByRole('button', { name: 'Editor', exact: true }).click();
  return { ...app, downloadRequests, input: app.page.getByPlaceholder('Paste viral link...') };
}

const waitForStoredAsset = page => page.waitForFunction(
  () => Boolean(JSON.parse(localStorage.getItem('viral_ranker_projects'))[0].clips[0].assetId),
  null,
  { timeout: 15000 }
);

test('typing a link sends nothing until Enter; the field keeps showing the source link', async () => {
  const { browser, page, downloadRequests, input } = await openWithMockedDownload();
  try {
    await input.pressSequentially(LINK, { delay: 5 });
    await page.waitForTimeout(500);
    assert.equal(downloadRequests.length, 0);

    await input.press('Enter');
    await waitForStoredAsset(page);
    assert.deepEqual(downloadRequests, [{ url: LINK }]);

    const clip = await page.evaluate(() => JSON.parse(localStorage.getItem('viral_ranker_projects'))[0].clips[0]);
    assert.equal(clip.url, `/api/files/${asset}`);
    assert.equal(clip.sourceUrl, LINK);
    assert.equal(await input.inputValue(), LINK);
  } finally {
    await browser.close();
  }
});

test('pasting a link into the empty field downloads it once', async () => {
  const { browser, page, downloadRequests, input } = await openWithMockedDownload();
  try {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(text => navigator.clipboard.writeText(text), LINK);
    await input.focus();
    await page.keyboard.press('Control+V');
    await waitForStoredAsset(page);
    assert.deepEqual(downloadRequests, [{ url: LINK }]);
  } finally {
    await browser.close();
  }
});

test('the download button submits the typed link', async () => {
  const { browser, page, downloadRequests, input } = await openWithMockedDownload();
  try {
    await input.fill(LINK);
    assert.equal(downloadRequests.length, 0);
    await page.getByRole('button', { name: 'Download video from link' }).click();
    await waitForStoredAsset(page);
    assert.deepEqual(downloadRequests, [{ url: LINK }]);
  } finally {
    await browser.close();
  }
});
