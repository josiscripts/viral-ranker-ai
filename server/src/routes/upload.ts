import { Router, Request, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import {
  validateVideoFile,
  saveUploadedVideo,
  ensureUploadTmpDir,
  UPLOAD_TMP_DIR
} from '../services/videoService';

const router = Router();

ensureUploadTmpDir();

// Files are streamed to a temporary folder on disk (not kept in RAM) and moved to
// the uploads folder with a server-generated name once validated.
const upload = multer({
  dest: UPLOAD_TMP_DIR,
  limits: {
    fileSize: 200 * 1024 * 1024,
    files: 1
  }
});

const removeTempFile = (file?: Express.Multer.File) => {
  if (file?.path && fs.existsSync(file.path)) {
    try {
      fs.unlinkSync(file.path);
    } catch (error) {
      console.error('Error removing temporary upload:', error);
    }
  }
};

router.post('/upload', (req: Request, res: Response) => {
  upload.single('video')(req, res, async (err: any) => {
    // Handle multer errors first
    if (err instanceof multer.MulterError) {
      removeTempFile(req.file);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size (200MB+) exceeds maximum allowed size of 200MB' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      removeTempFile(req.file);
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
        removeTempFile(req.file);
        return res.status(400).json({ error: validation.error });
      }

      // Move into storage and validate as MP4
      const uploadResult = await saveUploadedVideo(req.file.path, req.file.originalname);

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
      removeTempFile(req.file);
      console.error('Upload error:', error);
      return res.status(500).json({ error: 'Failed to upload video' });
    }
  });
});

export default router;
