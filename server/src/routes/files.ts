import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getFileStats } from '../services/videoService.js';

const router = Router();

router.get('/files/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    // Validate filename (security)
    if (!filename || filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const fileInfo = getFileStats(filename);
    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found' });
    }

    const { size, path: filePath } = fileInfo;

    // Handle Range requests for video seeking/scrubbing
    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : size - 1;

      if (start >= size || end >= size || start > end) {
        return res.status(416).set('Content-Range', `bytes */${size}`).send();
      }

      const chunkSize = end - start + 1;

      res.status(206);
      res.set({
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4'
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      // No range header - send entire file
      res.set({
        'Content-Length': size,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes'
      });

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  } catch (error) {
    console.error('File serving error:', error);
    return res.status(500).json({ error: 'Failed to serve file' });
  }
});

export default router;
