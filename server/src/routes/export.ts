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
  try {
    const { projectId, title, titlePosition, titleStroke, clips } = req.body as ExportRequest;

    // Validate input
    if (!projectId || !title || !titlePosition || !clips || clips.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: projectId, title, titlePosition, clips'
      });
    }

    if (clips.length > 10) {
      return res.status(400).json({
        error: 'Too many clips (maximum 10)'
      });
    }

    // Validate clips
    for (const clip of clips) {
      if (!clip.url || clip.startTime === undefined || clip.endTime === undefined) {
        return res.status(400).json({
          error: 'Each clip must have url, startTime, and endTime'
        });
      }
      if (clip.startTime >= clip.endTime) {
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
