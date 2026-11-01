// Pure helpers for the clip list (unit-tested in tests/unit).
import type { Clip } from '../types';

// The rank always follows the order of the list: the first clip is #1
export const renumberClips = (clips: Clip[]): Clip[] =>
  clips.map((clip, index) => (clip.rank === index + 1 ? clip : { ...clip, rank: index + 1 }));

// Swaps a clip with its neighbour (offset -1 = up, 1 = down) and renumbers
export const moveClip = (clips: Clip[], clipId: string, offset: -1 | 1): Clip[] => {
  const from = clips.findIndex(clip => clip.id === clipId);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= clips.length) return clips;
  const next = [...clips];
  [next[from], next[to]] = [next[to], next[from]];
  return renumberClips(next);
};

// Shortest trim allowed, so a clip never ends up empty
export const MIN_TRIM_SECONDS = 0.1;

const roundTime = (seconds: number) => Math.round(seconds * 100) / 100;

// Keeps a trim inside [0, duration] with start < end. `edited` is the side the user
// changed: that side is stopped at the other one instead of pushing it.
export const clampTrim = (
  startTime: number,
  endTime: number,
  duration: number | undefined,
  edited: 'start' | 'end'
): { startTime: number; endTime: number } => {
  const max = duration && duration > 0 ? duration : Infinity;
  let start = Number.isFinite(startTime) ? Math.min(Math.max(0, startTime), Math.max(0, max - MIN_TRIM_SECONDS)) : 0;
  let end = Number.isFinite(endTime) ? Math.min(Math.max(0, endTime), max) : start + MIN_TRIM_SECONDS;

  if (end - start < MIN_TRIM_SECONDS) {
    if (edited === 'start') start = Math.max(0, end - MIN_TRIM_SECONDS);
    else end = Math.min(max, start + MIN_TRIM_SECONDS);
  }
  if (end - start < MIN_TRIM_SECONDS) {
    // Both sides are pinned against a limit: keep the shortest valid trim
    start = Math.max(0, Math.min(start, max - MIN_TRIM_SECONDS));
    end = start + MIN_TRIM_SECONDS;
  }
  return { startTime: roundTime(start), endTime: roundTime(end) };
};

// Trim for a freshly loaded source: the first 5 seconds (or the whole clip if shorter)
export const initialTrim = (duration: number): { startTime: number; endTime: number } => ({
  startTime: 0,
  endTime: duration > 0 ? roundTime(Math.min(duration, 5)) : 5
});
