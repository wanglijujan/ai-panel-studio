import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import './db';
import { discussionsRouter } from './routes/discussions';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, data: { status: 'up' } }));
app.use('/api/discussions', discussionsRouter);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: { code: 'NOT_FOUND', message: `未知接口 ${req.method} ${req.path}` },
  });
});

const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`);
});
