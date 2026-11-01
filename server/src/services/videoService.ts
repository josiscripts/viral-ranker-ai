import fs from 'fs';
import path from 'path';
import { runProcess } from './processRunner';

const UPLOAD_DIR = path.join(process.cwd(), 'storage', 'uploads');
export const UPLOAD_TMP_DIR = path.join(process.cwd(), 'storage', 'tmp');
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const MAX_BASENAME_LENGTH = 60;

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

export const ensureUploadTmpDir = () => {
  if (!fs.existsSync(UPLOAD_TMP_DIR)) {
    fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true });
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

export const isValidMP4 = async (filePath: string): Promise<{ valid: boolean; error?: string }> => {
  try {
    const { stdout: output } = await runProcess('ffprobe', ['-v', 'error', '-show_format', '-show_streams', filePath]);

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

export const getVideoDuration = async (filePath: string): Promise<number> => {
  try {
    const { stdout } = await runProcess('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);
    const duration = parseFloat(stdout.trim());
    return isNaN(duration) ? 0 : duration;
  } catch (error) {
    console.error('Error getting video duration:', error);
    return 0;
  }
};

// The stored file name is generated on the server. The client's original name is
// only used as a readable hint and is reduced to [A-Za-z0-9_-].
const buildStoredFilename = (originalFilename: string): string => {
  const baseName = path.basename(originalFilename, path.extname(originalFilename));
  const safeBaseName = baseName
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_BASENAME_LENGTH);
  return `${Date.now()}_${safeBaseName || 'video'}.mp4`;
};

export const saveUploadedVideo = async (
  tempFilePath: string,
  originalFilename: string
): Promise<{ success: boolean; data?: UploadResponse; error?: string }> => {
  ensureUploadDir();

  const filename = buildStoredFilename(originalFilename);
  const filePath = path.join(UPLOAD_DIR, filename);

  try {
    fs.renameSync(tempFilePath, filePath);

    // Verify it's a valid MP4
    const validation = await isValidMP4(filePath);
    if (!validation.valid) {
      fs.unlinkSync(filePath);
      return { success: false, error: validation.error };
    }

    const duration = await getVideoDuration(filePath);

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
    for (const leftover of [tempFilePath, filePath]) {
      try {
        if (fs.existsSync(leftover)) {
          fs.unlinkSync(leftover);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up failed upload:', cleanupError);
      }
    }
    return { success: false, error: error.message || 'Failed to save video' };
  }
};

export const getFileStats = (filename: string): { size: number; path: string } | null => {
  const filePath = path.join(UPLOAD_DIR, filename);

  // Security: prevent path traversal
  if (!path.resolve(filePath).startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
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

// Resolves a client-supplied asset id (the stored file name returned by
// /api/upload or /api/download) to a file inside UPLOAD_DIR. Anything that is not
// a plain .mp4 file name inside that directory is rejected.
export const resolveAssetPath = (assetId: unknown): string | null => {
  if (typeof assetId !== 'string' || !assetId || assetId.includes('\0')) {
    return null;
  }
  if (path.basename(assetId) !== assetId || assetId.includes('/') || assetId.includes('\\')) {
    return null;
  }
  if (path.extname(assetId).toLowerCase() !== '.mp4') {
    return null;
  }

  const fileInfo = getFileStats(assetId);
  if (!fileInfo || !fs.statSync(fileInfo.path).isFile()) {
    return null;
  }
  return fileInfo.path;
};
