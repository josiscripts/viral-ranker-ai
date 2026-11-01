// P1-01: every export failure must be visible to the user (E-02).
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

const withClip = overrides => makeClip('clip_a', 1, { url: `http://localhost:3001/api/files/${asset}`, assetId: asset, duration: 2, ...overrides });

async function openEditor(projects, lang = 'en') {
  const app = await openApp({ projects, lang });
  await app.page.getByRole('button', { name: 'Editor', exact: true }).click();
  const exportRequests = [];
  app.page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/export')) exportRequests.push(request);
  });
  return { ...app, exportRequests };
}

const clickExport = (page, lang = 'en') => page.getByRole('button', { name: lang === 'es' ? 'EXPORTAR' : 'EXPORT', exact: true }).click();

test('a clip without video is reported before anything is sent', async () => {
  const { browser, page, exportRequests, consoleErrors } = await openEditor([makeProject([makeClip('clip_a', 1)])]);
  try {
    await clickExport(page);
    const alert = page.getByRole('alert');
    await alert.waitFor({ timeout: 5000 });
    assert.match(await alert.innerText(), /Clip 1: no video loaded/);
    assert.equal(exportRequests.length, 0);
    assert.deepEqual(consoleErrors, []);
  } finally {
    await browser.close();
  }
});

test('an invalid trim is reported before anything is sent (Spanish UI)', async () => {
  const { browser, page, exportRequests } = await openEditor([makeProject([withClip({ startTime: 1.5, endTime: 1 })])], 'es');
  try {
    await clickExport(page, 'es');
    const alert = page.getByRole('alert');
    await alert.waitFor({ timeout: 5000 });
    assert.match(await alert.innerText(), /Clip 1: el inicio debe ser anterior al final/);
    assert.equal(exportRequests.length, 0);
  } finally {
    await browser.close();
  }
});

test('a server rejection shows the server message', async () => {
  const { browser, page } = await openEditor([makeProject([withClip({ assetId: '1_missing_file.mp4', url: 'http://localhost:3001/api/files/1_missing_file.mp4' })])]);
  try {
    await clickExport(page);
    const alert = page.getByRole('alert');
    await alert.waitFor({ timeout: 10000 });
    const text = await alert.innerText();
    assert.match(text, /Export failed/i);
    assert.match(text, /has no uploaded or downloaded video on the server/);
  } finally {
    await browser.close();
  }
});

test('an unreachable server is reported and Retry sends a new request', async () => {
  const { browser, page, exportRequests } = await openEditor([makeProject([withClip()])]);
  try {
    await page.route('**/api/export', route => route.abort('connectionrefused'));
    await clickExport(page);
    const alert = page.getByRole('alert');
    await alert.waitFor({ timeout: 10000 });
    assert.match(await alert.innerText(), /Could not reach the server/);
    assert.equal(exportRequests.length, 1);

    await page.unroute('**/api/export');
    const download = page.waitForEvent('download', { timeout: 60000 });
    await alert.getByRole('button', { name: 'Retry' }).click();
    await download;
    assert.equal(exportRequests.length, 2);
    assert.equal(await page.getByRole('alert').count(), 0);
  } finally {
    await browser.close();
  }
});

test('a successful export shows the current step and downloads the file', async () => {
  const clips = [withClip(), makeClip('clip_b', 2, { url: `http://localhost:3001/api/files/${asset}`, assetId: asset, duration: 2 })];
  const { browser, page, consoleErrors } = await openEditor([makeProject(clips)]);
  try {
    const download = page.waitForEvent('download', { timeout: 60000 });
    await clickExport(page);
    await page.getByText(/Processing clip \d of 2/).waitFor({ timeout: 10000 });
    await download;
    assert.equal(await page.getByRole('alert').count(), 0);
    assert.deepEqual(consoleErrors, []);
  } finally {
    await browser.close();
  }
});
