import fs from 'fs';
import path from 'path';
import { runProcess, ProcessError } from './processRunner';
import { getVideoDuration } from './videoService';
import { UPLOAD_DIR } from '../config';

const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_DOWNLOAD_SIZE = '300M';
const MAX_VIDEO_DURATION_SECONDS = 900; // 15 minutes

export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'unknown';

export interface DownloadResponse {
  videoUrl: string;
  duration: number;
  filename: string;
  platform: Platform;
}

// Hostnames are matched exactly or as a subdomain ("www.youtube.com"), never as a
// substring: "youtube.com.attacker.example" must not be accepted.
const PLATFORM_HOSTS: Record<Exclude<Platform, 'unknown'>, string[]> = {
  youtube: ['youtube.com', 'youtu.be'],
  tiktok: ['tiktok.com'],
  instagram: ['instagram.com', 'instagr.am']
};

const hostMatches = (hostname: string, allowedHost: string): boolean =>
  hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);

export const parseSupportedUrl = (url: string): { platform: Platform; normalizedUrl: string } => {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
      return { platform: 'unknown', normalizedUrl: '' };
    }
    const hostname = urlObj.hostname.toLowerCase();

    for (const [platform, hosts] of Object.entries(PLATFORM_HOSTS)) {
      if (hosts.some(host => hostMatches(hostname, host))) {
        return { platform: platform as Platform, normalizedUrl: urlObj.href };
      }
    }
  } catch (error) {
    // URL parsing failed
  }

  return { platform: 'unknown', normalizedUrl: '' };
};

export const detectPlatform = (url: string): Platform => parseSupportedUrl(url).platform;

export const downloadVideo = async (url: string): Promise<{ success: boolean; data?: DownloadResponse; error?: string }> => {
  const { platform, normalizedUrl } = parseSupportedUrl(url);

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

    // Download video using yt-dlp. Arguments are passed without a shell, and "--"
    // guarantees the URL is never parsed as an option.
    try {
      await runProcess('yt-dlp', [
        '-f', 'best[ext=mp4]',
        '--no-playlist',
        '--max-filesize', MAX_DOWNLOAD_SIZE,
        '--match-filter', `duration <=? ${MAX_VIDEO_DURATION_SECONDS}`,
        '-o', filePath,
        '--', normalizedUrl
      ], { timeoutMs: DOWNLOAD_TIMEOUT_MS });
    } catch (downloadError: any) {
      const errorOutput = downloadError instanceof ProcessError
        ? `${downloadError.stderr}\n${downloadError.stdout}`
        : String(downloadError?.message || downloadError);

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

      return { success: false, error: `Download failed: ${errorOutput.trim().substring(0, 100)}` };
    }

    // yt-dlp exits successfully but writes nothing when a size/duration filter skips the video
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: `Video was not downloaded. It may exceed the limits (${MAX_DOWNLOAD_SIZE}B, ${MAX_VIDEO_DURATION_SECONDS / 60} minutes)`
      };
    }

    const stats = fs.statSync(filePath);
    if (stats.size < 1000) {
      // File too small, probably not a valid video
      fs.unlinkSync(filePath);
      return { success: false, error: 'Downloaded file is too small. Video may be invalid' };
    }

    const duration = await getVideoDuration(filePath);

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
