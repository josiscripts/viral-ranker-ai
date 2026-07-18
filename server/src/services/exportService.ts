import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  trimClip,
  addTextOverlay,
  concatenateClips,
  ensureDirectoryExists,
  deleteFile,
  deleteDirectory,
  getVideoDuration
} from './ffmpegService';

export interface ExportJob {
  jobId: string;
  projectId: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  currentStep: string;
  error?: string;
  downloadUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface ExportRequest {
  projectId: string;
  title: string;
  titlePosition: { x: number; y: number };
  titleStroke: number;
  clips: {
    id: string;
    url: string;
    startTime: number;
    endTime: number;
    rank: number;
    title: string;
    titleStyle?: { color: string };
    clipTitlePosition?: { x: number; y: number };
  }[];
}

const STORAGE_BASE = path.join(process.cwd(), 'storage');
const PROCESSING_DIR = path.join(STORAGE_BASE, 'processing');
const EXPORTS_DIR = path.join(STORAGE_BASE, 'exports');
const JOB_CLEANUP_INTERVAL = 60 * 1000; // 1 minute check
const JOB_EXPIRE_TIME = 60 * 60 * 1000; // 1 hour expiry

const jobs = new Map<string, ExportJob>();

// Initialize directories
ensureDirectoryExists(PROCESSING_DIR);
ensureDirectoryExists(EXPORTS_DIR);

// Start cleanup interval
setInterval(cleanupExpiredJobs, JOB_CLEANUP_INTERVAL);

export function createExportJob(projectId: string): string {
  const jobId = uuidv4();
  const now = new Date();

  const job: ExportJob = {
    jobId,
    projectId,
    status: 'queued',
    progress: 0,
    currentStep: 'Queued',
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

export function updateJobProgress(jobId: string, progress: number, currentStep: string): void {
  const job = jobs.get(jobId);
  if (job) {
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
    ensureDirectoryExists(jobDir);

    // Sort clips by rank
    const sortedClips = [...request.clips].sort((a, b) => a.rank - b.rank);

    // Step 1: Trim and overlay text for each clip
    const processedClips: string[] = [];
    const totalClips = sortedClips.length;

    for (let i = 0; i < sortedClips.length; i++) {
      const clip = sortedClips[i];
      updateJobProgress(jobId, (i / totalClips) * 60, `Processing clip ${i + 1}/${totalClips}`);

      // Map pixel positions from 540px preview to 1080px video
      const mainTitleX = Math.round((request.titlePosition.x / 540) * 1080);
      const mainTitleY = Math.round((request.titlePosition.y / 1920) * 1920);
      const clipTitleX = clip.clipTitlePosition
        ? Math.round((clip.clipTitlePosition.x / 540) * 1080)
        : mainTitleX;
      const clipTitleY = clip.clipTitlePosition
        ? Math.round((clip.clipTitlePosition.y / 1920) * 1920)
        : mainTitleY + 100;

      const trimmedPath = path.join(jobDir, `clip_${i}_trimmed.mp4`);
      const finalPath = path.join(jobDir, `clip_${i}_final.mp4`);

      // Extract URL (could be local file path)
      const clipUrl = clip.url.startsWith('http')
        ? clip.url
        : path.join(STORAGE_BASE, clip.url);

      // Trim the clip
      await trimClip({
        inputPath: clipUrl,
        outputPath: trimmedPath,
        startTime: clip.startTime,
        endTime: clip.endTime
      });

      // Add text overlay
      await addTextOverlay({
        inputPath: trimmedPath,
        outputPath: finalPath,
        mainTitle: request.title,
        mainTitleX,
        mainTitleY,
        clipTitle: clip.title,
        clipTitleX,
        clipTitleY,
        mainTitleColor: '#FFFFFF',
        mainTitleStroke: request.titleStroke || 2,
        clipTitleColor: '#FFFFFF',
        clipTitleStroke: request.titleStroke || 2
      });

      // Clean up trimmed file
      deleteFile(trimmedPath);
      processedClips.push(finalPath);
    }

    // Step 2: Concatenate all clips
    updateJobProgress(jobId, 70, 'Concatenating clips');

    const outputPath = path.join(EXPORTS_DIR, `${jobId}.mp4`);
    await concatenateClips({
      clipPaths: processedClips,
      outputPath
    });

    // Step 3: Clean up processing directory
    updateJobProgress(jobId, 90, 'Cleaning up');
    processedClips.forEach(deleteFile);
    deleteDirectory(jobDir);

    // Complete job
    const downloadUrl = `/api/files/${jobId}.mp4`;
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
