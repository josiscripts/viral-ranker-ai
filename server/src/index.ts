import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRoutes from './routes/health';
import uploadRoutes from './routes/upload';
import filesRoutes from './routes/files';
import downloadRoutes from './routes/download';
import exportRoutes from './routes/export';

dotenv.config();

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

app.use(express.json());

app.use('/api', healthRoutes);
app.use('/api', uploadRoutes);
app.use('/api', filesRoutes);
app.use('/api', downloadRoutes);
app.use('/api', exportRoutes);

app.listen(PORT, HOST, () => {
  console.log(`✅ Server running on http://${HOST}:${PORT}`);
  console.log(`📡 CORS enabled for ${FRONTEND_URL}`);
  console.log(`📁 Video uploads: /server/storage/uploads`);
});
