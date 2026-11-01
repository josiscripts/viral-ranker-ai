import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import {
  renderClipSegment,
  TextLayer,
  TITLE_FONT_SIZE,
  concatenateClips,
  ensureDirectoryExists,
  deleteFile,
  deleteDirectory
} from './ffmpegService';
import { resolveAssetPath } from './videoService';
import { STORAGE_DIR, PROCESSING_DIR, EXPORTS_DIR } from '../config';

// Machine-readable step, so the client can show it in the user's language
export type ExportStepKey = 'queued' | 'processingClip' | 'concatenating' | 'cleaningUp' | 'completed';

export interface ExportStep {
  key: ExportStepKey;
  clip?: number; // 1-based
  total?: number;
}

export interface ExportJob {
  jobId: string;
  projectId: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  currentStep: string;
  step: ExportStep;
  error?: string;
  downloadUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

// Center of a title as fractions of the canvas (0..1)
export interface NormalizedPosition {
  fx: number;
  fy: number;
}

// Same default as the preview (utils/titleLayout.ts)
const DEFAULT_CLIP_TITLE_POSITION: NormalizedPosition = { fx: 0.5, fy: 0.5 };

export interface ExportRequest {
  projectId: string;
  title: string;
  titlePosition: NormalizedPosition;
  titleStroke: number;
  background?: string; // hex color around the video
  videoHeight?: number; // % of the canvas height covered by the video
  clips: {
    id: string;
    // Stored file name returned by /api/upload or /api/download. The server only
    // processes files from its own upload directory, never client URLs or paths.
    assetId: string;
    startTime: number;
    endTime: number;
    rank: number;
    title: string;
    titleStyle?: { color: string };
    clipTitlePosition?: NormalizedPosition;
  }[];
}

console.log('DEBUG: Storage paths configured:');
console.log('  STORAGE_DIR:', STORAGE_DIR);
console.log('  PROCESSING_DIR:', PROCESSING_DIR);
console.log('  EXPORTS_DIR:', EXPORTS_DIR);
const JOB_CLEANUP_INTERVAL = 60 * 1000; // 1 minute check
const JOB_EXPIRE_TIME = 60 * 60 * 1000; // 1 hour expiry

const jobs = new Map<string, ExportJob>();

// Initialize directories
ensureDirectoryExists(PROCESSING_DIR);
ensureDirectoryExists(EXPORTS_DIR);

// Start cleanup interval
setInterval(cleanupExpiredJobs, JOB_CLEANUP_INTERVAL);

export function createExportJob(projectId: string): string {
  const jobId = randomUUID();
  const now = new Date();

  const job: ExportJob = {
    jobId,
    projectId,
    status: 'queued',
    progress: 0,
    currentStep: 'Queued',
    step: { key: 'queued' },
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + JOB_EXPIRE_TIME)
  };

  jobs.set(jobId, job);
  return jobId;
}

export function getJob(jobId: string): ExportJob | undefined {
  return jobs.get(jobId);
}

// Path of the finished export for a known, completed job. The file name is always
// rebuilt from the server-generated job id, never taken from the request.
export function getExportFilePath(jobId: string): string | null {
  const job = jobs.get(jobId);
  if (!job || job.status !== 'completed') return null;

  const filePath = path.join(EXPORTS_DIR, `${job.jobId}.mp4`);
  return fs.existsSync(filePath) ? filePath : null;
}

export function updateJobProgress(jobId: string, progress: number, currentStep: string, step: ExportStep): void {
  const job = jobs.get(jobId);
  if (job) {
    job.status = 'processing';
    job.step = step;
    job.progress = Math.min(100, Math.max(0, progress));
    job.currentStep = currentStep;
    job.updatedAt = new Date();
  }
}

export function completeJob(jobId: string, downloadUrl: string): void {
  const job = jobs.get(jobId);
  if (job) {
    job.status = 'completed';
    job.progress = 100;
    job.currentStep = 'Export completed';
    job.step = { key: 'completed' };
    job.downloadUrl = downloadUrl;
    job.updatedAt = new Date();
  }
}

export function failJob(jobId: string, error: string): void {
  const job = jobs.get(jobId);
  if (job) {
    job.status = 'error';
    job.error = error;
    job.updatedAt = new Date();
    // Clean up processing directory for this job
    const jobProcessingDir = path.join(PROCESSING_DIR, jobId);
    deleteDirectory(jobProcessingDir);
  }
}

export async function processExportJob(jobId: string, request: ExportRequest): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) throw new Error('Job not found');

  try {
    const jobDir = path.join(PROCESSING_DIR, jobId);
    console.log(`\n=== STARTING EXPORT JOB ${jobId} ===`);
    console.log('Job directory:', jobDir);
    ensureDirectoryExists(jobDir);
    console.log('Job directory created successfully');

    // Sort clips by rank
    const sortedClips = [...request.clips].sort((a, b) => a.rank - b.rank);
    console.log(`Processing ${sortedClips.length} clips in order`);

    // Step 1: Trim and overlay text for each clip
    const processedClips: string[] = [];
    const totalClips = sortedClips.length;

    // Real progress: clip segments take 0-90 %, weighted by their trimmed length
    const totalSeconds = sortedClips.reduce((sum, c) => sum + (c.endTime - c.startTime), 0);
    let doneSeconds = 0;

    for (let i = 0; i < sortedClips.length; i++) {
      const clip = sortedClips[i];
      const clipSeconds = clip.endTime - clip.startTime;
      const step: ExportStep = { key: 'processingClip', clip: i + 1, total: totalClips };
      const reportProgress = (fraction: number) => updateJobProgress(
        jobId, ((doneSeconds + clipSeconds * fraction) / totalSeconds) * 90, `Processing clip ${i + 1}/${totalClips}`, step
      );
      reportProgress(0);

      const clipUrl = resolveAssetPath(clip.assetId);
      if (!clipUrl) {
        throw new Error(`Video file for clip "${clip.title}" was not found on the server`);
      }

      const finalPath = path.join(jobDir, `clip_${i}_final.mp4`);
      const stroke = request.titleStroke ?? 2;
      // Positions are the title centers as fractions of the canvas, as in the preview
      const clipTitlePosition = clip.clipTitlePosition ?? DEFAULT_CLIP_TITLE_POSITION;
      const texts: TextLayer[] = [{ text: request.title, ...request.titlePosition, fontSize: TITLE_FONT_SIZE, color: '#FFFFFF', stroke }];
      if (clip.title) texts.push({ text: clip.title, ...clipTitlePosition, fontSize: TITLE_FONT_SIZE, color: '#FFFFFF', stroke });

      await renderClipSegment({
        inputPath: clipUrl,
        outputPath: finalPath,
        workDir: jobDir,
        textFilePrefix: `clip_${i}`,
        startTime: clip.startTime,
        endTime: clip.endTime,
        background: request.background || '#000000',
        videoHeightPercent: request.videoHeight ?? 100,
        texts,
        onProgress: reportProgress
      });

      doneSeconds += clipSeconds;
      processedClips.push(finalPath);
    }

    // Step 2: Concatenate all clips
    updateJobProgress(jobId, 92, 'Concatenating clips', { key: 'concatenating' });

    const outputPath = path.join(EXPORTS_DIR, `${jobId}.mp4`);
    await concatenateClips({
      clipPaths: processedClips,
      outputPath
    });

    // Step 3: Clean up processing directory
    updateJobProgress(jobId, 98, 'Cleaning up', { key: 'cleaningUp' });
    processedClips.forEach(deleteFile);
    deleteDirectory(jobDir);

    // Complete job
    const downloadUrl = `/api/export/${jobId}/file`;
    completeJob(jobId, downloadUrl);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    failJob(jobId, errorMessage);
    throw error;
  }
}

function cleanupExpiredJobs(): void {
  const now = new Date();
  const expiredJobIds: string[] = [];

  jobs.forEach((job, jobId) => {
    if (job.expiresAt < now) {
      expiredJobIds.push(jobId);
      // Clean up files
      if (job.status === 'completed' && job.downloadUrl) {
        const filePath = path.join(EXPORTS_DIR, `${jobId}.mp4`);
        deleteFile(filePath);
      }
      const jobProcessingDir = path.join(PROCESSING_DIR, jobId);
      deleteDirectory(jobProcessingDir);
    }
  });

  expiredJobIds.forEach(jobId => jobs.delete(jobId));
  if (expiredJobIds.length > 0) {
    console.log(`Cleaned up ${expiredJobIds.length} expired export jobs`);
  }
}

export function cleanupJobsManually(): void {
  cleanupExpiredJobs();
}
