import { Router, Request, Response } from 'express';
import {
  createExportJob,
  getJob,
  processExportJob,
  ExportRequest
} from '../services/exportService';

const router = Router();

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

    const { projectId, title, titlePosition, titleStroke, clips } = req.body as ExportRequest;

    // Validate input
    console.log('DEBUG: Validation checks - projectId:', !!projectId, 'title:', !!title, 'titlePosition:', !!titlePosition, 'clips:', clips?.length);

    if (!projectId || !title || !titlePosition || !clips || clips.length === 0) {
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

    // Validate clips
    for (const clip of clips) {
      console.log('DEBUG: Validating clip:', {
        id: clip.id,
        url: clip.url ? 'exists' : 'missing',
        startTime: clip.startTime,
        endTime: clip.endTime,
        rank: clip.rank,
        title: clip.title
      });

      if (!clip.url || clip.startTime === undefined || clip.endTime === undefined) {
        console.log('DEBUG: Clip validation failed - missing url/startTime/endTime');
        return res.status(400).json({
          error: 'Each clip must have url, startTime, and endTime'
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

export default router;
