import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import eventsRouter from './src/routes/events.js';
import uploadRouter from './src/routes/upload.js';
import authRouter from './src/routes/auth.js';
import searchRouter from './src/routes/search.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/search', searchRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => console.log(`🚀  Flyer Wall API running on http://localhost:${PORT}`));
