// P1-08: async results must not overwrite edits or other projects (E-11), and the
// active clip must follow the open project (E-09). /api/download is mocked with a delay.
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

const storedProjects = page => page.evaluate(() => JSON.parse(localStorage.getItem('viral_ranker_projects')));

async function mockSlowDownload(page, delayMs) {
  await page.route('**/api/download', async route => {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await route.fulfill({ json: { videoUrl: `/api/files/${asset}`, filename: asset, duration: 2, platform: 'youtube' } });
  });
}

const startDownload = async (page, nth) => {
  const input = page.getByPlaceholder('Paste viral link...').nth(nth);
  await input.fill(LINK);
  await input.press('Enter');
};

const waitForAssets = (page, projectId, count) => page.waitForFunction(({ projectId, count }) => {
  const project = JSON.parse(localStorage.getItem('viral_ranker_projects')).find(p => p.id === projectId);
  return project.clips.filter(c => c.assetId).length >= count;
}, { projectId, count }, { timeout: 15000 });

test('editing another clip during a download keeps the edit', async () => {
  const { browser, page } = await openApp({ projects: [makeProject([makeClip('clip_a', 1), makeClip('clip_b', 2)])] });
  try {
    await mockSlowDownload(page, 1500);
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    await startDownload(page, 0);
    await page.getByPlaceholder('Enter Title...').nth(1).fill('EDITED WHILE DOWNLOADING');
    await waitForAssets(page, 'proj_e2e', 1);
    await page.waitForTimeout(300);

    const [project] = await storedProjects(page);
    assert.equal(project.clips[0].assetId, asset);
    assert.equal(project.clips[1].title, 'EDITED WHILE DOWNLOADING');
  } finally {
    await browser.close();
  }
});

test('two downloads at the same time both land in their clips', async () => {
  const { browser, page } = await openApp({ projects: [makeProject([makeClip('clip_a', 1), makeClip('clip_b', 2)])] });
  try {
    await mockSlowDownload(page, 1000);
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    await startDownload(page, 0);
    await startDownload(page, 1);
    await waitForAssets(page, 'proj_e2e', 2);
  } finally {
    await browser.close();
  }
});

test('switching project during a download does not touch the other project', async () => {
  const projectA = makeProject([makeClip('a1', 1, { title: 'A FIRST' })], { id: 'proj_a', title: 'PROJECT A' });
  const projectB = makeProject([makeClip('b1', 1, { title: 'B FIRST' }), makeClip('b2', 2, { title: 'B SECOND' })], { id: 'proj_b', title: 'PROJECT B' });
  const { browser, page } = await openApp({ projects: [projectA, projectB] });
  try {
    await mockSlowDownload(page, 2000);
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    await startDownload(page, 0);
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await page.getByText('PROJECT B', { exact: true }).click();
    await waitForAssets(page, 'proj_a', 1);
    await page.waitForTimeout(300);

    const [storedA, storedB] = await storedProjects(page);
    assert.equal(storedA.clips[0].assetId, asset);
    assert.deepEqual(storedB.clips.map(c => c.title), ['B FIRST', 'B SECOND']);
    assert.ok(storedB.clips.every(c => !c.assetId));
  } finally {
    await browser.close();
  }
});

test('after switching project the clip title of the new project can be dragged', async () => {
  const projectA = makeProject([makeClip('a1', 1, { title: 'A FIRST' }), makeClip('a2', 2, { title: 'A SECOND' })], { id: 'proj_a', title: 'PROJECT A', enableTitleDrag: true });
  const projectB = makeProject([makeClip('b1', 1, { title: 'B FIRST', clipTitlePosition: { fx: 0.5, fy: 0.5 } })], { id: 'proj_b', title: 'PROJECT B', enableTitleDrag: true });
  const { browser, page } = await openApp({ projects: [projectA, projectB] });
  try {
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    await page.getByPlaceholder('Enter Title...').nth(1).click(); // activates clip a2
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await page.getByText('PROJECT B', { exact: true }).click();

    const clipTitle = page.locator('div.cursor-move', { hasText: /b first/i });
    const box = await clipTitle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 60, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const [, storedB] = await storedProjects(page);
    assert.ok(storedB.clips[0].clipTitlePosition.fy > 0.52, JSON.stringify(storedB.clips[0].clipTitlePosition));
  } finally {
    await browser.close();
  }
});
