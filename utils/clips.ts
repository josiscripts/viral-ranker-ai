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
