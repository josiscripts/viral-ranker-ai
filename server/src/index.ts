// Load .env before any other module reads process.env at import time
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import healthRoutes from './routes/health';
import uploadRoutes from './routes/upload';
import filesRoutes from './routes/files';
import downloadRoutes from './routes/download';
import exportRoutes from './routes/export';
import { UPLOAD_DIR } from './config';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
// Listen on localhost only unless HOST is set explicitly (e.g. 0.0.0.0 inside a container)
const HOST = process.env.HOST || '127.0.0.1';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const APP_REQUEST_HEADER = 'x-requested-with';
const APP_REQUEST_HEADER_VALUE = 'viral-ranker';

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  })
);

// State-changing requests must carry a custom header. Browsers can only send it
// after a CORS preflight, which is limited to FRONTEND_URL, so other websites can
// no longer submit "simple" cross-site requests (e.g. multipart uploads) here.
app.use('/api', (req, res, next) => {
  if (req.method === 'POST' && req.get(APP_REQUEST_HEADER) !== APP_REQUEST_HEADER_VALUE) {
    return res.status(403).json({ error: 'Missing application request header' });
  }
  next();
});

// Rate limits per client IP. The expensive endpoints (ffmpeg/yt-dlp work) get
// their own tight budget; everything else, including export status polling
// (every 500 ms), shares a generous one.
const createLimiter = (windowMs: number, limit: number) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please wait a few minutes and try again' }
  });

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
app.use('/api', createLimiter(60 * 1000, 300));
app.post('/api/upload', createLimiter(FIFTEEN_MINUTES_MS, 30));
app.post('/api/download', createLimiter(FIFTEEN_MINUTES_MS, 20));
app.post('/api/export', createLimiter(FIFTEEN_MINUTES_MS, 10));

app.use(express.json());

app.use('/api', healthRoutes);
app.use('/api', uploadRoutes);
app.use('/api', filesRoutes);
app.use('/api', downloadRoutes);
app.use('/api', exportRoutes);

app.listen(PORT, HOST, () => {
  console.log(`✅ Server running on http://${HOST}:${PORT}`);
  console.log(`📡 CORS enabled for ${FRONTEND_URL}`);
  console.log(`📁 Video uploads: ${UPLOAD_DIR}`);
});
