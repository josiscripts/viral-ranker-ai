import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const UPLOAD_DIR = path.join(process.cwd(), 'storage', 'uploads');
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

export interface UploadResponse {
  videoUrl: string;
  duration: number;
  filename: string;
}

export const ensureUploadDir = () => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
};

export const validateVideoFile = (
  filename: string | undefined,
  size: number
): { valid: boolean; error?: string } => {
  if (!filename) {
    return { valid: false, error: 'No file provided' };
  }

  // Validate by extension (primary validation)
  const ext = path.extname(filename).toLowerCase();
  if (ext !== '.mp4') {
    return { valid: false, error: `Only .mp4 files are allowed. File has extension: ${ext || '(none)'}` };
  }

  // Validate file size
  if (size > MAX_FILE_SIZE) {
    const sizeMB = Math.round(size / (1024 * 1024));
    return {
      valid: false,
      error: `File size (${sizeMB}MB) exceeds maximum allowed size of 200MB`
    };
  }

  return { valid: true };
};

export const isValidMP4 = (filePath: string): { valid: boolean; error?: string } => {
  try {
    // Use simpler, more compatible ffprobe syntax
    const command = `ffprobe -v error -show_format -show_streams "${filePath}"`;
    const output = execSync(command, { encoding: 'utf-8' });

    // Check for format name in output
    if (!output.includes('mov') && !output.includes('mp4') && !output.includes('format_name')) {
      // If we can't determine format, try to see if it's a video stream at least
      if (!output.includes('video')) {
        return { valid: false, error: 'File is not a valid MP4 video' };
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Unable to verify video format. File may be corrupted.' };
  }
};

export const getVideoDuration = (filePath: string): number => {
  try {
    // Use simpler, more compatible ffprobe syntax
    const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    const output = execSync(command, { encoding: 'utf-8' });
    const duration = parseFloat(output.trim());
    return isNaN(duration) ? 0 : duration;
  } catch (error) {
    console.error('Error getting video duration:', error);
    return 0;
  }
};

export const saveUploadedVideo = (
  fileBuffer: Buffer,
  originalFilename: string
): { success: boolean; data?: UploadResponse; error?: string } => {
  ensureUploadDir();

  const timestamp = Date.now();
  const filename = `${timestamp}_${path.basename(originalFilename)}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  try {
    fs.writeFileSync(filePath, fileBuffer);

    // Verify it's a valid MP4
    const validation = isValidMP4(filePath);
    if (!validation.valid) {
      fs.unlinkSync(filePath);
      return { success: false, error: validation.error };
    }

    const duration = getVideoDuration(filePath);

    return {
      success: true,
      data: {
        videoUrl: `/api/files/${filename}`,
        duration,
        filename
      }
    };
  } catch (error: any) {
    // Clean up partially written file
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up failed upload:', cleanupError);
    }
    return { success: false, error: error.message || 'Failed to save video' };
  }
};

export const getFileStats = (filename: string): { size: number; path: string } | null => {
  const filePath = path.join(UPLOAD_DIR, filename);

  // Security: prevent path traversal
  if (!path.resolve(filePath).startsWith(path.resolve(UPLOAD_DIR))) {
    return null;
  }

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const stats = fs.statSync(filePath);
  return {
    size: stats.size,
    path: filePath
  };
};
