import * as fs from 'fs';
import * as path from 'path';
import { runProcess } from './processRunner';

interface TrimOptions {
  inputPath: string;
  outputPath: string;
  startTime: number;
  endTime: number;
}

interface DrawTextOptions {
  inputPath: string;
  outputPath: string;
  // Directory where the title text files are written. ffmpeg runs with this
  // directory as cwd so the filter only references plain relative file names.
  workDir: string;
  textFilePrefix: string;
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

const FFMPEG_BASE_ARGS = ['-hide_banner', '-v', 'error', '-nostdin'];

const toFilterNumber = (value: number, name: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid numeric value for ${name}`);
  }
  return Math.round(value);
};

// Only hex colors (with or without "#") or "white" ever reach the filter graph.
const toFilterColor = (color: string | undefined, fallback: string): string => {
  const hex = (color || '').replace('#', '');
  return /^[0-9A-Fa-f]{6}$/.test(hex) ? hex : fallback;
};

// drawtext always gets an explicit font file: without one it depends on a
// fontconfig setup, and current Windows ffmpeg builds crash when none is found.
const SYSTEM_FONT_CANDIDATES: Record<string, string[]> = {
  win32: [
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arialbd.ttf'),
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arial.ttf')
  ],
  linux: [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
  ],
  darwin: [
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/Library/Fonts/Arial.ttf'
  ]
};

// FONT_FILE (env) wins over the system defaults. Paths are escaped for the filter
// graph; paths containing quotes are rejected instead of escaped twice.
const getFontFileOption = (): string => {
  const candidates = process.env.FONT_FILE
    ? [process.env.FONT_FILE]
    : SYSTEM_FONT_CANDIDATES[process.platform] || [];
  const fontFile = candidates.find(candidate => !candidate.includes("'") && fs.existsSync(candidate));

  if (!fontFile) {
    throw new Error('No font file available for video titles. Set FONT_FILE in server/.env to a .ttf/.otf file');
  }

  const escaped = fontFile.replace(/\\/g, '/').replace(/:/g, '\\:');
  return `:fontfile='${escaped}'`;
};

export async function trimClip(options: TrimOptions): Promise<void> {
  const { inputPath, outputPath, startTime, endTime } = options;

  console.log('DEBUG trimClip: outputPath =', outputPath);

  try {
    await runProcess('ffmpeg', [
      ...FFMPEG_BASE_ARGS,
      // Inputs are always server-side files; never let ffmpeg open network or other protocols
      '-protocol_whitelist', 'file',
      '-i', inputPath,
      '-ss', String(startTime),
      '-to', String(endTime),
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-c:a', 'aac',
      '-y', // overwrite output
      outputPath
    ]);
  } catch (error: any) {
    throw new Error(`FFmpeg trim error: ${error.stderr || error.message}`);
  }
}

export async function addTextOverlay(options: DrawTextOptions): Promise<void> {
  const {
    inputPath,
    outputPath,
    workDir,
    textFilePrefix,
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

  // Titles are written to files and read with textfile= + expansion=none, so no
  // character of the title (quotes, ":", ",", "%", new lines...) is ever parsed
  // as filter syntax.
  const mainTitleFile = `${textFilePrefix}_main.txt`;
  fs.writeFileSync(path.join(workDir, mainTitleFile), mainTitle.replace(/\r/g, ''), 'utf-8');

  const cleanMainColor = toFilterColor(mainTitleColor, 'white');
  const cleanClipColor = toFilterColor(clipTitleColor, cleanMainColor);
  const fontOption = getFontFileOption();

  // Build drawtext filter (multiple filters separated by comma)
  let filterComplex = `drawtext=textfile=${mainTitleFile}:expansion=none:x=${toFilterNumber(mainTitleX, 'mainTitleX')}:y=${toFilterNumber(mainTitleY, 'mainTitleY')}:fontsize=40:fontcolor=${cleanMainColor}:borderw=${toFilterNumber(mainTitleStroke, 'mainTitleStroke')}:bordercolor=black${fontOption}`;

  if (clipTitle && clipTitleX !== undefined && clipTitleY !== undefined) {
    const clipTitleFile = `${textFilePrefix}_clip.txt`;
    fs.writeFileSync(path.join(workDir, clipTitleFile), clipTitle.replace(/\r/g, ''), 'utf-8');
    filterComplex += `,drawtext=textfile=${clipTitleFile}:expansion=none:x=${toFilterNumber(clipTitleX, 'clipTitleX')}:y=${toFilterNumber(clipTitleY, 'clipTitleY')}:fontsize=32:fontcolor=${cleanClipColor}:borderw=${toFilterNumber(clipTitleStroke ?? mainTitleStroke, 'clipTitleStroke')}:bordercolor=black${fontOption}`;
  }

  console.log('DEBUG addTextOverlay: inputPath =', inputPath);
  console.log('DEBUG addTextOverlay: outputPath =', outputPath);
  console.log('DEBUG addTextOverlay: filterComplex =', filterComplex);

  try {
    await runProcess('ffmpeg', [
      ...FFMPEG_BASE_ARGS,
      '-protocol_whitelist', 'file',
      '-i', inputPath,
      '-vf', filterComplex,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-c:a', 'aac',
      '-y',
      outputPath
    ], { cwd: workDir });
  } catch (error: any) {
    throw new Error(`FFmpeg text overlay error: ${error.stderr || error.message}`);
  }
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

  // Create concat list file (single quotes inside a path are escaped as '\'')
  const concatListPath = path.join(path.dirname(outputPath), 'concat_list.txt');
  const concatContent = clipPaths
    .map(clipPath => `file '${clipPath.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
    .join('\n');

  fs.writeFileSync(concatListPath, concatContent, 'utf-8');

  try {
    await runProcess('ffmpeg', [
      ...FFMPEG_BASE_ARGS,
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c', 'copy',
      '-y',
      outputPath
    ]);
  } catch (error: any) {
    throw new Error(`FFmpeg concatenate error: ${error.stderr || error.message}`);
  } finally {
    // Clean up concat list
    try {
      fs.unlinkSync(concatListPath);
    } catch (e) {
      // Ignore
    }
  }
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
