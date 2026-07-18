import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRoutes from './routes/health';
import uploadRoutes from './routes/upload';
import filesRoutes from './routes/files';
import downloadRoutes from './routes/download';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  })
);

app.use(express.json());

app.use('/api', healthRoutes);
app.use('/api', uploadRoutes);
app.use('/api', filesRoutes);
app.use('/api', downloadRoutes);

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📡 CORS enabled for ${FRONTEND_URL}`);
  console.log(`📁 Video uploads: /server/storage/uploads`);
});
