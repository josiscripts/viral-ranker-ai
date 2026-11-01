import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { OVERLAYS_DIR } from '../config';
import { OUTPUT_WIDTH, OUTPUT_HEIGHT } from './ffmpegService';

// Design layers rendered by the browser from the preview (titles, rank list,
// shading), one transparent PNG per clip, burned over the video on export.
// They are single-use: the export job that references them deletes them.

export const MAX_OVERLAY_BYTES = 8 * 1024 * 1024;
const OVERLAY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/;
const OVERLAY_MAX_AGE_MS = 60 * 60 * 1000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_COLOR_TYPE_RGBA = 6;

fs.mkdirSync(OVERLAYS_DIR, { recursive: true });

// Checks the PNG header only: ffmpeg decodes the rest, and a broken image fails the export
export function validateOverlayPng(data: Buffer): string | null {
  if (data.length < 33 || !data.subarray(0, 8).equals(PNG_SIGNATURE) || data.toString('latin1', 12, 16) !== 'IHDR') {
    return 'Overlay must be a PNG image';
  }
  if (data.readUInt32BE(16) !== OUTPUT_WIDTH || data.readUInt32BE(20) !== OUTPUT_HEIGHT) {
    return `Overlay must be ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}`;
  }
  if (data[25] !== PNG_COLOR_TYPE_RGBA) {
    return 'Overlay must have an alpha channel (RGBA)';
  }
  return null;
}

export function saveOverlay(data: Buffer): string {
  const overlayId = `${randomUUID()}.png`;
  fs.writeFileSync(path.join(OVERLAYS_DIR, overlayId), data, { flag: 'wx' });
  return overlayId;
}

// Only server-generated names inside OVERLAYS_DIR are ever resolved
export function resolveOverlayPath(overlayId: unknown): string | null {
  if (typeof overlayId !== 'string' || !OVERLAY_ID_PATTERN.test(overlayId)) return null;
  const filePath = path.join(OVERLAYS_DIR, overlayId);
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : null;
}

export function deleteOverlay(overlayId: string | undefined): void {
  const filePath = resolveOverlayPath(overlayId);
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error(`Failed to delete overlay ${overlayId}:`, error);
  }
}

// Overlays never used by an export (e.g. the browser closed mid-export)
export function deleteStaleOverlays(now = Date.now()): void {
  for (const name of fs.readdirSync(OVERLAYS_DIR)) {
    const filePath = path.join(OVERLAYS_DIR, name);
    try {
      if (now - fs.statSync(filePath).mtimeMs > OVERLAY_MAX_AGE_MS) fs.unlinkSync(filePath);
    } catch (error) {
      console.error(`Failed to delete stale overlay ${name}:`, error);
    }
  }
}
