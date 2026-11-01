// P1-09: ranks always 1..N in list order (E-12)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renumberClips, moveClip } from '../../utils/clips.ts';
import type { Clip } from '../../types.ts';

const clip = (id: string, rank: number): Clip => ({ id, url: '', startTime: 0, endTime: 1, rank, title: id });
const ranks = (clips: Clip[]) => clips.map(c => `${c.id}:${c.rank}`);

test('renumbering fixes gaps and duplicates in list order', () => {
  assert.deepEqual(ranks(renumberClips([clip('a', 1), clip('c', 3), clip('d', 3)])), ['a:1', 'c:2', 'd:3']);
});

test('renumbering keeps unchanged clips as the same objects', () => {
  const a = clip('a', 1);
  assert.equal(renumberClips([a, clip('b', 5)])[0], a);
});

test('add after delete never duplicates a rank', () => {
  let clips = renumberClips([clip('a', 1), clip('b', 2), clip('c', 3)]);
  clips = renumberClips(clips.filter(c => c.id !== 'b'));
  clips = renumberClips([...clips, clip('d', clips.length + 1)]);
  assert.deepEqual(ranks(clips), ['a:1', 'c:2', 'd:3']);
});

test('moving swaps neighbours and renumbers', () => {
  const clips = [clip('a', 1), clip('b', 2), clip('c', 3)];
  assert.deepEqual(ranks(moveClip(clips, 'c', -1)), ['a:1', 'c:2', 'b:3']);
  assert.deepEqual(ranks(moveClip(clips, 'a', 1)), ['b:1', 'a:2', 'c:3']);
});

test('moving past the ends or an unknown clip changes nothing', () => {
  const clips = [clip('a', 1), clip('b', 2)];
  assert.equal(moveClip(clips, 'a', -1), clips);
  assert.equal(moveClip(clips, 'b', 1), clips);
  assert.equal(moveClip(clips, 'x', 1), clips);
});
