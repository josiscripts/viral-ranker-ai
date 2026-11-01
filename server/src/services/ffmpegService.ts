import * as fs from 'fs';
import * as path from 'path';
import { runProcess } from './processRunner';

export const OUTPUT_WIDTH = 1080;
export const OUTPUT_HEIGHT = 1920;
const OUTPUT_FPS = 30;
const OUTPUT_SAMPLE_RATE = 48000;
const SEGMENT_TIMEOUT_MS = 5 * 60 * 1000;
// The preview lays titles out on a 432x768 stage (utils/titleLayout.ts), 2.5x
// smaller than the output: 16 px text there is 40 px here, and its 24 px line
// height leaves ~12 px between lines on top of Inter's own line height.
export const TITLE_FONT_SIZE = 40;
const TITLE_LINE_SPACING = 12;

export interface TextLayer {
  text: string;
  // Center of the text as fractions of the canvas, like the preview
  fx: number;
  fy: number;
  fontSize: number;
  color: string;
  stroke: number;
  font?: FontVariant;
}

interface SegmentOptions {
  inputPath: string;
  outputPath: string;
  workDir: string;
  textFilePrefix: string;
  startTime: number;
  endTime: number;
  background: string;
  videoHeightPercent: number; // share of the canvas height the video covers, like the preview
  texts: TextLayer[];
  // Transparent 1080x1920 PNG with the preview's design layer, drawn over the video
  overlayPath?: string;
  onProgress?: (fraction: number) => void;
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

// Positions only reach the filter graph as plain decimals in [0, 1]
const toFilterFraction = (value: number, name: string): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`Invalid position value for ${name}`);
  }
  return value.toFixed(4);
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

// Inter (OFL), the preview's font, ships in server/assets/fonts. Same relative
// path from src/services and from dist/services.
export type FontVariant = 'bold' | 'boldItalic' | 'medium';
const BUNDLED_FONTS_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');
const BUNDLED_FONT_FILES: Record<FontVariant, string> = {
  bold: 'Inter-Bold.ttf',
  boldItalic: 'Inter-BoldItalic.ttf',
  medium: 'Inter-Medium.ttf'
};

// FONT_FILE (env) wins for every variant, then the bundled Inter, then system fonts.
// Paths containing quotes are skipped instead of escaped twice in the filter graph.
export const resolveFontFile = (variant: FontVariant = 'bold'): string => {
  const candidates = process.env.FONT_FILE
    ? [process.env.FONT_FILE]
    : [path.join(BUNDLED_FONTS_DIR, BUNDLED_FONT_FILES[variant]), ...(SYSTEM_FONT_CANDIDATES[process.platform] || [])];
  const fontFile = candidates.find(candidate => !candidate.includes("'") && fs.existsSync(candidate));

  if (!fontFile) {
    throw new Error('No font file available for video titles. Set FONT_FILE in server/.env to a .ttf/.otf file');
  }
  return fontFile;
};

const getFontFileOption = (variant: FontVariant = 'bold'): string => {
  const escaped = resolveFontFile(variant).replace(/\\/g, '/').replace(/:/g, '\\:');
  return `:fontfile='${escaped}'`;
};

export async function hasAudioStream(inputPath: string): Promise<boolean> {
  const { stdout } = await runProcess('ffprobe', [
    '-v', 'error', '-protocol_whitelist', 'file', '-select_streams', 'a',
    '-show_entries', 'stream=index', '-of', 'csv=p=0', inputPath
  ]);
  return stdout.trim().length > 0;
}

// Seconds already encoded, from one chunk of `-progress pipe:1` output
export function parseProgressSeconds(chunk: string): number | null {
  const matches = [...chunk.matchAll(/out_time_us=(\d+)/g)];
  return matches.length ? Number(matches[matches.length - 1][1]) / 1_000_000 : null;
}

// One pass per clip: trim, cover the video area like the preview's object-cover,
// pad to 1080x1920 with the background, 30 fps, titles, and AAC 48 kHz stereo
// (silence when the source has none). Every segment has the same parameters, so
// the final concat can copy the streams.
export async function renderClipSegment(options: SegmentOptions): Promise<void> {
  const { inputPath, outputPath, workDir, textFilePrefix, startTime, endTime, texts, onProgress } = options;
  const duration = endTime - startTime;
  const areaHeight = Math.round((OUTPUT_HEIGHT * Math.min(100, Math.max(10, options.videoHeightPercent))) / 200) * 2;
  const background = toFilterColor(options.background, '000000');

  const drawTexts = texts.map((layer, index) => {
    const file = `${textFilePrefix}_text${index}.txt`;
    fs.writeFileSync(path.join(workDir, file), layer.text.replace(/\r/g, ''), 'utf-8');
    return `drawtext=textfile=${file}:expansion=none:x=w*${toFilterFraction(layer.fx, 'fx')}-text_w/2:y=h*${toFilterFraction(layer.fy, 'fy')}-text_h/2` +
      `:text_align=C:line_spacing=${TITLE_LINE_SPACING}` +
      `:fontsize=${toFilterNumber(layer.fontSize, 'fontSize')}:fontcolor=${toFilterColor(layer.color, 'FFFFFF')}` +
      `:borderw=${toFilterNumber(layer.stroke, 'stroke')}:bordercolor=black${getFontFileOption(layer.font)}`;
  });

  const base = [
    `scale=${OUTPUT_WIDTH}:${areaHeight}:force_original_aspect_ratio=increase:force_divisible_by=2`,
    `crop=${OUTPUT_WIDTH}:${areaHeight}`,
    `pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:0:(oh-ih)/2:color=0x${background}`,
    'setsar=1',
    `fps=${OUTPUT_FPS}`
  ].join(',');
  const audio = `aresample=${OUTPUT_SAMPLE_RATE},aformat=sample_fmts=fltp:channel_layouts=stereo,apad`;

  const withAudio = await hasAudioStream(inputPath);
  const args = [
    ...FFMPEG_BASE_ARGS,
    '-protocol_whitelist', 'file',
    '-ss', String(startTime), '-t', String(duration), '-i', inputPath
  ];
  let nextInput = 1;
  let video = `[0:v]${[base, 'format=yuv420p', ...drawTexts].join(',')}[v]`;
  if (options.overlayPath) {
    // -f png_pipe reads the file as a single PNG, never as an image2 name pattern;
    // overlay keeps repeating that one frame (eof_action=repeat) for the whole clip
    args.push('-f', 'png_pipe', '-i', options.overlayPath);
    video = `[0:v]${base}[base];[${nextInput}:v]format=rgba[layer];` +
      `[base][layer]overlay=0:0:format=auto,${['format=yuv420p', ...drawTexts].join(',')}[v]`;
    nextInput++;
  }
  let audioInput = '0:a';
  if (!withAudio) {
    args.push('-f', 'lavfi', '-t', String(duration), '-i', `anullsrc=channel_layout=stereo:sample_rate=${OUTPUT_SAMPLE_RATE}`);
    audioInput = `${nextInput}:a`;
  }
  args.push(
    '-filter_complex', `${video};[${audioInput}]${audio}[a]`,
    '-map', '[v]', '-map', '[a]',
    '-t', String(duration),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-r', String(OUTPUT_FPS),
    '-c:a', 'aac', '-b:a', '160k', '-ar', String(OUTPUT_SAMPLE_RATE), '-ac', '2',
    '-progress', 'pipe:1', '-nostats',
    '-y', outputPath
  );

  try {
    await runProcess('ffmpeg', args, {
      cwd: workDir,
      timeoutMs: SEGMENT_TIMEOUT_MS,
      onStdout: chunk => {
        const seconds = parseProgressSeconds(chunk);
        if (seconds !== null && onProgress && duration > 0) onProgress(Math.min(1, seconds / duration));
      }
    });
  } catch (error: any) {
    throw new Error(`FFmpeg render error: ${error.stderr || error.message}`);
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
      '-movflags', '+faststart',
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
