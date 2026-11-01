import { Router, Request, Response } from 'express';
import {
  createExportJob,
  getJob,
  getExportFilePath,
  processExportJob,
  ExportRequest
} from '../services/exportService';
import { resolveAssetPath } from '../services/videoService';

const router = Router();

const MAX_TITLE_LENGTH = 100;
const MAX_TITLE_STROKE = 8;
const JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Control characters are rejected; a line break is allowed because the main title can span lines
const FORBIDDEN_TITLE_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F]/;

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const MIN_VIDEO_HEIGHT = 10;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isValidPosition = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const position = value as { x?: unknown; y?: unknown };
  return isFiniteNumber(position.x) && isFiniteNumber(position.y);
};

const isValidTitle = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_TITLE_LENGTH && !FORBIDDEN_TITLE_CHARS.test(value);

// POST /api/export - Start export job
router.post('/export', async (req: Request, res: Response) => {
  console.log('=== INCOMING EXPORT REQUEST ===');
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Headers:', req.headers);
  console.log('===================================');

  try {
    console.log('DEBUG: POST /api/export received:', {
      body: req.body,
      projectId: req.body?.projectId,
      title: req.body?.title,
      titlePosition: req.body?.titlePosition,
      titleStroke: req.body?.titleStroke,
      clipsCount: req.body?.clips?.length,
      clipsFields: req.body?.clips?.[0] ? Object.keys(req.body.clips[0]) : 'none'
    });

    const { projectId, title, titlePosition, titleStroke, background, videoHeight, clips } = req.body as ExportRequest;

    // Validate input
    console.log('DEBUG: Validation checks - projectId:', !!projectId, 'title:', !!title, 'titlePosition:', !!titlePosition, 'clips:', clips?.length);

    if (!projectId || !title || !titlePosition || !Array.isArray(clips) || clips.length === 0) {
      console.log('DEBUG: Missing required fields validation failed');
      return res.status(400).json({
        error: 'Missing required fields: projectId, title, titlePosition, clips'
      });
    }

    if (clips.length > 10) {
      console.log('DEBUG: Too many clips:', clips.length);
      return res.status(400).json({
        error: 'Too many clips (maximum 10)'
      });
    }

    if (typeof projectId !== 'string' || !isValidTitle(title) || !isValidPosition(titlePosition)) {
      return res.status(400).json({
        error: `Invalid project data: title must be text of at most ${MAX_TITLE_LENGTH} characters and titlePosition must have numeric x/y`
      });
    }

    if (titleStroke !== undefined && (!Number.isInteger(titleStroke) || titleStroke < 0 || titleStroke > MAX_TITLE_STROKE)) {
      return res.status(400).json({
        error: `titleStroke must be an integer between 0 and ${MAX_TITLE_STROKE}`
      });
    }

    if (background !== undefined && (typeof background !== 'string' || !HEX_COLOR.test(background))) {
      return res.status(400).json({ error: 'background must be a hex color like #000000' });
    }

    if (videoHeight !== undefined && (!isFiniteNumber(videoHeight) || videoHeight < MIN_VIDEO_HEIGHT || videoHeight > 100)) {
      return res.status(400).json({ error: `videoHeight must be a number between ${MIN_VIDEO_HEIGHT} and 100` });
    }

    // Validate clips
    for (const clip of clips) {
      console.log('DEBUG: Validating clip:', {
        id: clip?.id,
        assetId: clip?.assetId,
        startTime: clip?.startTime,
        endTime: clip?.endTime,
        rank: clip?.rank,
        title: clip?.title
      });

      if (!clip || typeof clip !== 'object' || !isFiniteNumber(clip.startTime) || !isFiniteNumber(clip.endTime) || !isFiniteNumber(clip.rank)) {
        console.log('DEBUG: Clip validation failed - missing assetId/startTime/endTime/rank');
        return res.status(400).json({
          error: 'Each clip must have assetId, numeric startTime, endTime and rank'
        });
      }
      if (!isValidTitle(clip.title)) {
        return res.status(400).json({
          error: `Clip titles must be text of at most ${MAX_TITLE_LENGTH} characters`
        });
      }
      if (clip.clipTitlePosition !== undefined && !isValidPosition(clip.clipTitlePosition)) {
        return res.status(400).json({
          error: `Clip "${clip.title}": clipTitlePosition must have numeric x/y`
        });
      }
      if (!resolveAssetPath(clip.assetId)) {
        return res.status(400).json({
          error: `Clip "${clip.title}" has no uploaded or downloaded video on the server`
        });
      }
      if (clip.startTime < 0) {
        return res.status(400).json({
          error: `Clip "${clip.title}": startTime cannot be negative`
        });
      }
      if (clip.startTime >= clip.endTime) {
        console.log(`DEBUG: Clip "${clip.title}" validation failed - startTime >= endTime`);
        return res.status(400).json({
          error: `Clip "${clip.title}": startTime must be less than endTime`
        });
      }
    }

    // Create job
    const jobId = createExportJob(projectId);

    // Start processing in background (don't await)
    processExportJob(jobId, req.body).catch(error => {
      console.error(`Export job ${jobId} failed:`, error);
    });

    // Return job ID immediately
    return res.json({ jobId });

  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({
      error: 'Failed to start export job'
    });
  }
});

// GET /api/export/:jobId - Get job status
router.get('/export/:jobId', (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const job = getJob(jobId);
    if (!job) {
      return res.status(404).json({
        error: 'Job not found'
      });
    }

    return res.json({
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      step: job.step,
      error: job.error,
      downloadUrl: job.downloadUrl
    });

  } catch (error) {
    console.error('Get job status error:', error);
    return res.status(500).json({
      error: 'Failed to get job status'
    });
  }
});

// GET /api/export/:jobId/file - Download a finished export
router.get('/export/:jobId/file', (req: Request, res: Response) => {
  const { jobId } = req.params;

  if (!JOB_ID_PATTERN.test(jobId)) {
    return res.status(400).json({ error: 'Invalid job id' });
  }

  const filePath = getExportFilePath(jobId);
  if (!filePath) {
    return res.status(404).json({ error: 'Export file not found' });
  }

  return res.download(filePath, `${jobId}.mp4`);
});

export default router;
