import { execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TrimOptions {
  inputPath: string;
  outputPath: string;
  startTime: number;
  endTime: number;
}

interface DrawTextOptions {
  inputPath: string;
  outputPath: string;
  mainTitle: string;
  mainTitleX: number;
  mainTitleY: number;
  clipTitle?: string;
  clipTitleX?: number;
  clipTitleY?: number;
  mainTitleColor: string;
  mainTitleStroke: number;
  clipTitleColor?: string;
  clipTitleStroke?: number;
}

interface ConcatOptions {
  clipPaths: string[];
  outputPath: string;
}

export async function trimClip(options: TrimOptions): Promise<void> {
  const { inputPath, outputPath, startTime, endTime } = options;

  const cmd = [
    'ffmpeg',
    '-i', inputPath,
    '-ss', startTime.toString(),
    '-to', endTime.toString(),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-c:a', 'aac',
    '-y', // overwrite output
    outputPath
  ].join(' ');

  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`FFmpeg trim error: ${stderr || error.message}`));
      } else {
        resolve();
      }
    });
  });
}

export async function addTextOverlay(options: DrawTextOptions): Promise<void> {
  const {
    inputPath,
    outputPath,
    mainTitle,
    mainTitleX,
    mainTitleY,
    clipTitle,
    clipTitleX,
    clipTitleY,
    mainTitleColor,
    mainTitleStroke,
    clipTitleColor,
    clipTitleStroke
  } = options;

  // Escape special characters in text for FFmpeg
  const escapedMainTitle = mainTitle.replace(/'/g, "\\'").replace(/:/g, "\\:");
  const escapedClipTitle = clipTitle?.replace(/'/g, "\\'").replace(/:/g, "\\:") || '';

  // Remove hashtag from color if present, use 'white' as fallback
  const cleanMainColor = mainTitleColor.replace('#', '') || 'white';
  const cleanClipColor = clipTitleColor?.replace('#', '') || cleanMainColor || 'white';

  // Build drawtext filter (multiple filters separated by comma)
  let filterComplex = `drawtext=text='${escapedMainTitle}':x=${mainTitleX}:y=${mainTitleY}:fontsize=40:fontcolor=${cleanMainColor}:borderw=${mainTitleStroke}:bordercolor=black`;

  if (clipTitle && clipTitleX !== undefined && clipTitleY !== undefined) {
    filterComplex += `,drawtext=text='${escapedClipTitle}':x=${clipTitleX}:y=${clipTitleY}:fontsize=32:fontcolor=${cleanClipColor}:borderw=${clipTitleStroke || mainTitleStroke}:bordercolor=black`;
  }

  const cmd = [
    'ffmpeg',
    '-i', inputPath,
    '-vf', filterComplex,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-c:a', 'aac',
    '-y',
    outputPath
  ].join(' ');

  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`FFmpeg text overlay error: ${stderr || error.message}`));
      } else {
        resolve();
      }
    });
  });
}

export async function concatenateClips(options: ConcatOptions): Promise<void> {
  const { clipPaths, outputPath } = options;

  if (clipPaths.length === 0) {
    throw new Error('No clips to concatenate');
  }

  if (clipPaths.length === 1) {
    // Single clip, just copy
    fs.copyFileSync(clipPaths[0], outputPath);
    return;
  }

  // Create concat list file
  const concatListPath = path.join(path.dirname(outputPath), 'concat_list.txt');
  const concatContent = clipPaths
    .map(clipPath => `file '${clipPath.replace(/\\/g, '/')}'`)
    .join('\n');

  fs.writeFileSync(concatListPath, concatContent, 'utf-8');

  const cmd = [
    'ffmpeg',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-c', 'copy',
    '-y',
    outputPath
  ].join(' ');

  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      // Clean up concat list
      try {
        fs.unlinkSync(concatListPath);
      } catch (e) {
        // Ignore
      }

      if (error) {
        reject(new Error(`FFmpeg concatenate error: ${stderr || error.message}`));
      } else {
        resolve();
      }
    });
  });
}

export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function deleteFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`Failed to delete file ${filePath}:`, error);
  }
}

export function deleteDirectory(dirPath: string): void {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(`Failed to delete directory ${dirPath}:`, error);
  }
}

export async function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const cmd = [
      'ffprobe',
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ].join(' ');

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`FFprobe error: ${stderr || error.message}`));
      } else {
        const duration = parseFloat(stdout.trim());
        if (isNaN(duration)) {
          reject(new Error('Could not parse video duration'));
        } else {
          resolve(duration);
        }
      }
    });
  });
}
