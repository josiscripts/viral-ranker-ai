import type { NormalizedPosition } from '../types';

// The preview overlay (titles, rank list) is laid out on this fixed stage, the
// desktop size of the preview canvas, and scaled to the canvas with CSS. Text
// therefore keeps the same size and place relative to the canvas at any window
// size, and the export (1080x1920) is the same stage scaled by 2.5.
export const PREVIEW_STAGE = { width: 432, height: 768 };

// Older versions stored pixel offsets from the center of the desktop canvas
// (432x790 then; it was not exactly 9:16)
const LEGACY_CANVAS = { width: 432, height: 790 };

export const DEFAULT_TITLE_POSITION: NormalizedPosition = { fx: 0.5, fy: 0.22 };
export const DEFAULT_CLIP_TITLE_POSITION: NormalizedPosition = { fx: 0.5, fy: 0.5 };

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const round4 = (value: number): number => Math.round(value * 10000) / 10000;

// Keeps a box of half size (halfWidth, halfHeight), as fractions of the canvas,
// fully inside it; a box larger than the canvas is centered
export const clampPosition = (position: NormalizedPosition, halfWidth = 0, halfHeight = 0): NormalizedPosition => {
  const fit = (value: number, half: number) => (half >= 0.5 ? 0.5 : Math.min(1 - half, Math.max(half, value)));
  return { fx: round4(fit(position.fx, halfWidth)), fy: round4(fit(position.fy, halfHeight)) };
};

// Accepts a normalized position, a legacy pixel offset, or nothing
export const migratePosition = (value: unknown, fallback: NormalizedPosition): NormalizedPosition => {
  if (!value || typeof value !== 'object') return fallback;
  const position = value as { fx?: unknown; fy?: unknown; x?: unknown; y?: unknown };
  if (typeof position.fx === 'number' && typeof position.fy === 'number' && Number.isFinite(position.fx) && Number.isFinite(position.fy)) {
    return { fx: round4(clamp01(position.fx)), fy: round4(clamp01(position.fy)) };
  }
  if (typeof position.x === 'number' && typeof position.y === 'number' && Number.isFinite(position.x) && Number.isFinite(position.y)) {
    return {
      fx: round4(clamp01(0.5 + position.x / LEGACY_CANVAS.width)),
      fy: round4(clamp01(0.5 + position.y / LEGACY_CANVAS.height))
    };
  }
  return fallback;
};
