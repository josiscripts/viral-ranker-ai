import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'storage', 'uploads');

export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'unknown';

export interface DownloadResponse {
  videoUrl: string;
  duration: number;
  filename: string;
  platform: Platform;
}

export const detectPlatform = (url: string): Platform => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      return 'youtube';
    }
    if (hostname.includes('tiktok.com') || hostname.includes('vm.tiktok.com')) {
      return 'tiktok';
    }
    if (hostname.includes('instagram.com') || hostname.includes('instagr.am')) {
      return 'instagram';
    }
  } catch (error) {
    // URL parsing failed
  }

  return 'unknown';
};

export const getVideoDuration = (filePath: string): number => {
  try {
    const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    const output = execSync(command, { encoding: 'utf-8' });
    const duration = parseFloat(output.trim());
    return isNaN(duration) ? 0 : duration;
  } catch (error) {
    console.error('Error getting video duration:', error);
    return 0;
  }
};

export const downloadVideo = (url: string): { success: boolean; data?: DownloadResponse; error?: string } => {
  const platform = detectPlatform(url);

  if (platform === 'unknown') {
    return { success: false, error: 'Unsupported platform. Supported: YouTube, TikTok, Instagram' };
  }

  try {
    // Ensure upload directory exists
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const timestamp = Date.now();
    const filename = `${timestamp}_${platform}.mp4`;
    const filePath = path.join(UPLOAD_DIR, filename);

    // Download video using yt-dlp
    const command = `yt-dlp -f best[ext=mp4] -o "${filePath}" "${url}" 2>&1`;

    try {
      execSync(command, { encoding: 'utf-8', timeout: 300000 }); // 5 minute timeout
    } catch (downloadError: any) {
      const errorOutput = downloadError.stderr || downloadError.message || String(downloadError);

      // Detect specific error types
      if (errorOutput.includes('private') || errorOutput.includes('restricted')) {
        return { success: false, error: 'Video is private or age-restricted' };
      }
      if (errorOutput.includes('not found') || errorOutput.includes('does not exist') || errorOutput.includes('removed')) {
        return { success: false, error: 'Video not found or has been removed' };
      }
      if (errorOutput.includes('429') || errorOutput.includes('rate')) {
        return { success: false, error: 'Rate limited. Please wait a moment and try again' };
      }
      if (errorOutput.includes('403')) {
        return { success: false, error: 'Access denied. Video may be region-restricted' };
      }

      return { success: false, error: `Download failed: ${errorOutput.substring(0, 100)}` };
    }

    // Verify file was created and is valid MP4
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Download completed but file not found' };
    }

    const stats = fs.statSync(filePath);
    if (stats.size < 1000) {
      // File too small, probably not a valid video
      fs.unlinkSync(filePath);
      return { success: false, error: 'Downloaded file is too small. Video may be invalid' };
    }

    const duration = getVideoDuration(filePath);

    return {
      success: true,
      data: {
        videoUrl: `/api/files/${filename}`,
        duration,
        filename,
        platform
      }
    };
  } catch (error: any) {
    console.error('Download error:', error);
    return { success: false, error: error.message || 'Unexpected error during download' };
  }
};
