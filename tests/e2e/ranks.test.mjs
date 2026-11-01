// P1-09: ranks stay 1..N in list order after adding, deleting and reordering (E-12)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStack, openApp, makeProject, makeClip } from './helpers.mjs';

let stack;
before(async () => { stack = await startStack(); });
after(async () => { await stack?.stop(); });

const storedClips = page => page.evaluate(() => JSON.parse(localStorage.getItem('viral_ranker_projects'))[0].clips.map(c => `${c.title}:${c.rank}`));

test('delete then add never duplicates a rank', async () => {
  const clips = [makeClip('a', 1, { title: 'A' }), makeClip('b', 2, { title: 'B' }), makeClip('c', 3, { title: 'C' })];
  const { browser, page } = await openApp({ projects: [makeProject(clips)] });
  try {
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    await page.locator('button:has(.lucide-trash-2)').nth(1).click();
    await page.getByRole('button', { name: 'Add Clip' }).click();
    const stored = await storedClips(page);
    assert.deepEqual(stored.map(s => s.split(':')[1]), ['1', '2', '3']);
    assert.deepEqual(stored.slice(0, 2), ['A:1', 'C:2']);
  } finally {
    await browser.close();
  }
});

test('move buttons reorder clips and renumber them', async () => {
  const clips = [makeClip('a', 1, { title: 'A' }), makeClip('b', 2, { title: 'B' }), makeClip('c', 3, { title: 'C' })];
  const { browser, page } = await openApp({ projects: [makeProject(clips)] });
  try {
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    await page.getByRole('button', { name: 'Move clip up' }).nth(2).click();
    assert.deepEqual(await storedClips(page), ['A:1', 'C:2', 'B:3']);
    assert.equal(await page.getByRole('button', { name: 'Move clip up' }).first().isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Move clip down' }).last().isDisabled(), true);
  } finally {
    await browser.close();
  }
});

test('projects saved with duplicated ranks are renumbered on load', async () => {
  const clips = [makeClip('a', 1, { title: 'A' }), makeClip('b', 3, { title: 'B' }), makeClip('c', 3, { title: 'C' })];
  const { browser, page } = await openApp({ projects: [makeProject(clips)] });
  try {
    assert.deepEqual(await storedClips(page), ['A:1', 'B:2', 'C:3']);
  } finally {
    await browser.close();
  }
});
