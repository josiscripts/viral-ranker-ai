// P1-09: ranks always 1..N in list order (E-12); P1-10: valid trims
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renumberClips, moveClip, clampTrim, initialTrim } from '../../utils/clips.ts';
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

// P1-10: a trim can never be saved invalid (E-13, E-29, E-30)
test('trim values are kept inside [0, duration]', () => {
  assert.deepEqual(clampTrim(-3, 50, 20, 'start'), { startTime: 0, endTime: 20 });
  assert.deepEqual(clampTrim(25, 30, 20, 'start'), { startTime: 19.9, endTime: 20 });
});

test('the edited side stops at the other one', () => {
  assert.deepEqual(clampTrim(8, 5, 20, 'start'), { startTime: 4.9, endTime: 5 });
  assert.deepEqual(clampTrim(8, 5, 20, 'end'), { startTime: 8, endTime: 8.1 });
});

test('valid trims are untouched and unknown durations only clamp at 0', () => {
  assert.deepEqual(clampTrim(1.5, 4, 20, 'end'), { startTime: 1.5, endTime: 4 });
  assert.deepEqual(clampTrim(30, 45, undefined, 'end'), { startTime: 30, endTime: 45 });
});

test('NaN input never produces NaN', () => {
  const trim = clampTrim(NaN, NaN, 10, 'start');
  assert.ok(Number.isFinite(trim.startTime) && Number.isFinite(trim.endTime));
  assert.ok(trim.startTime < trim.endTime);
});

test('a new source starts at 0 and lasts up to 5 s, even without a duration', () => {
  assert.deepEqual(initialTrim(12), { startTime: 0, endTime: 5 });
  assert.deepEqual(initialTrim(2.345), { startTime: 0, endTime: 2.35 });
  assert.deepEqual(initialTrim(0), { startTime: 0, endTime: 5 });
});
