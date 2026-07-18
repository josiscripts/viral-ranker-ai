import { Router, Request, Response } from 'express';
import { downloadVideo } from '../services/downloadService';

const router = Router();

router.post('/download', (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      return res.status(400).json({ error: 'URL cannot be empty' });
    }

    // Validate URL format
    try {
      new URL(trimmedUrl);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Download video
    const result = downloadVideo(trimmedUrl);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Download failed' });
    }

    const data = result.data!;
    return res.status(200).json({
      videoUrl: data.videoUrl,
      duration: data.duration,
      filename: data.filename,
      platform: data.platform
    });
  } catch (error: any) {
    console.error('Download endpoint error:', error);
    return res.status(500).json({ error: 'Server error during download' });
  }
});

export default router;
