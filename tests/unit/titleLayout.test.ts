// P1-02: title positions are fractions of the canvas, migrated from old pixel offsets
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampPosition, migratePosition, DEFAULT_TITLE_POSITION } from '../../utils/titleLayout.ts';

test('legacy pixel offsets from the canvas center become fractions', () => {
  assert.deepEqual(migratePosition({ x: 0, y: 0 }, DEFAULT_TITLE_POSITION), { fx: 0.5, fy: 0.5 });
  assert.deepEqual(migratePosition({ x: 0, y: -220 }, DEFAULT_TITLE_POSITION), { fx: 0.5, fy: 0.2215 });
  assert.deepEqual(migratePosition({ x: 108, y: 395 }, DEFAULT_TITLE_POSITION), { fx: 0.75, fy: 1 });
  assert.deepEqual(migratePosition({ x: -5000, y: 5000 }, DEFAULT_TITLE_POSITION), { fx: 0, fy: 1 });
});

test('normalized positions are kept, clamped to the canvas', () => {
  assert.deepEqual(migratePosition({ fx: 0.3, fy: 0.8 }, DEFAULT_TITLE_POSITION), { fx: 0.3, fy: 0.8 });
  assert.deepEqual(migratePosition({ fx: -1, fy: 2 }, DEFAULT_TITLE_POSITION), { fx: 0, fy: 1 });
});

test('missing or broken positions fall back to the default', () => {
  for (const value of [undefined, null, 'top', {}, { x: '1', y: 2 }, { fx: NaN, fy: 0.5 }]) {
    assert.deepEqual(migratePosition(value, DEFAULT_TITLE_POSITION), DEFAULT_TITLE_POSITION);
  }
});

test('clampPosition keeps the whole box inside the canvas', () => {
  assert.deepEqual(clampPosition({ fx: 0.05, fy: 0.98 }, 0.2, 0.05), { fx: 0.2, fy: 0.95 });
  assert.deepEqual(clampPosition({ fx: 0.5, fy: 0.5 }, 0.1, 0.1), { fx: 0.5, fy: 0.5 });
  assert.deepEqual(clampPosition({ fx: 0.9, fy: 0.1 }, 0.7, 0.1), { fx: 0.5, fy: 0.1 });
});
