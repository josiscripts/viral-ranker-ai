import { Router, Request, Response } from 'express';
import multer from 'multer';
import { MAX_OVERLAY_BYTES, validateOverlayPng, saveOverlay } from '../services/overlayService';

const router = Router();

// Overlays are small (mostly transparent PNGs), so they are checked in memory
// and only written to disk once valid, with a server-generated name.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_OVERLAY_BYTES, files: 1, fields: 0 }
});

// POST /api/overlays - Store the design layer of one clip, returns its id for /api/export
router.post('/overlays', (req: Request, res: Response) => {
  upload.single('overlay')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const tooLarge = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({ error: tooLarge ? 'Overlay image is too large' : `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ error: 'Overlay upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No overlay provided' });
    }

    const error = validateOverlayPng(req.file.buffer);
    if (error) {
      return res.status(400).json({ error });
    }

    try {
      return res.json({ overlayId: saveOverlay(req.file.buffer) });
    } catch (saveError) {
      console.error('Failed to save overlay:', saveError);
      return res.status(500).json({ error: 'Failed to save overlay' });
    }
  });
});

export default router;
