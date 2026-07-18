import { Router, Request, Response } from 'express';
import multer from 'multer';
import { validateVideoFile, saveUploadedVideo } from '../services/videoService.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024
  }
});

// Error handler for multer
const handleMulterError = (err: any, req: Request, res: Response, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size (200MB+) exceeds maximum allowed size of 200MB' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ error: 'File upload failed' });
  }
  next();
};

router.post('/upload', (req: Request, res: Response, next: any) => {
  upload.single('video')(req, res, (err: any) => {
    // Handle multer errors first
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size (200MB+) exceeds maximum allowed size of 200MB' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: 'File upload failed' });
    }

    try {
      // Validate file exists
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      // Validate by filename and size
      const validation = validateVideoFile(req.file.originalname, req.file.size);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Save and validate as MP4
      const uploadResult = saveUploadedVideo(req.file.buffer, req.file.originalname);

      if (!uploadResult.success) {
        return res.status(400).json({ error: uploadResult.error });
      }

      const data = uploadResult.data!;
      return res.status(200).json({
        videoUrl: data.videoUrl,
        duration: data.duration,
        filename: data.filename
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      return res.status(500).json({ error: error.message || 'Failed to upload video' });
    }
  });
});

export default router;
