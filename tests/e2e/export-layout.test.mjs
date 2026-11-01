// P1-03: the export request carries the project's background and video height,
// with values the server accepts even for old projects.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startStack, openApp, makeTempDir, makeVideoFixture, uploadFixture, makeProject, makeClip } from './helpers.mjs';

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

async function exportPayload(projectOverrides) {
  const clip = makeClip('clip_a', 1, { url: `/api/files/${asset}`, assetId: asset, duration: 2 });
  const { browser, page } = await openApp({ projects: [makeProject([clip], projectOverrides)] });
  try {
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    const [request] = await Promise.all([
      page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/api/export')),
      page.getByRole('button', { name: 'EXPORT', exact: true }).click()
    ]);
    const response = await request.response();
    return { body: request.postDataJSON(), status: response.status() };
  } finally {
    await browser.close();
  }
}

test('export sends the project background and video height', async () => {
  const { body, status } = await exportPayload({ background: '#ff0000', videoHeight: 60 });
  assert.equal(body.background, '#ff0000');
  assert.equal(body.videoHeight, 60);
  assert.equal(status, 200);
});

test('old projects with invalid layout values still export', async () => {
  // The editor already raises a too-low height to its minimum; too-high ones are capped here
  for (const videoHeight of [null, 150]) {
    const { body, status } = await exportPayload({ background: 'red', videoHeight });
    assert.equal(body.background, '#000000');
    assert.ok(body.videoHeight >= 10 && body.videoHeight <= 100, String(body.videoHeight));
    assert.equal(status, 200);
  }
});
