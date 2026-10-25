import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline } from './src/pipeline/runPipeline.js';
import { stageMeta } from './src/pipeline/stages.js';
import { startPipelineJob, getPipelineJob } from './src/jobs.js';
import { STACKS } from './src/domain/stacks.js';
import { PROJECT_TYPES, TEAM_SIZES } from './src/domain/types.js';
import { buildBriefMarkdown } from './src/export/markdown.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');

// ── Coarse per-IP rate limiter for the pipeline endpoint ────────────────────
// In-memory backstop to protect the LLM keys from a demo-day stampede.
// Per-instance state (Vercel may have several), so it's a brake, not a quota.
const RATE_BUCKET = new Map();
const RATE_LIMIT_RUNS = 6;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip) {
  const now = Date.now();
  if (RATE_BUCKET.size > 500) {
    for (const [key, hits] of RATE_BUCKET) {
      if (hits.every(ts => now - ts >= RATE_WINDOW_MS)) RATE_BUCKET.delete(key);
    }
    if (RATE_BUCKET.size > 500) RATE_BUCKET.clear();
  }
  const hits = (RATE_BUCKET.get(ip) || []).filter(ts => now - ts < RATE_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_RUNS) return true;
  hits.push(now);
  RATE_BUCKET.set(ip, hits);
  return false;
}

/**
 * Builds the full Express app (API + production static serving).
 *
 * Exportable (not listening) so it can run as:
 *  - a long-lived local server  → node backend/server.js
 *  - a Vercel serverless function → api/index.js (imports this)
 */
export function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // ── API ───────────────────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'abridgeai-backend' });
  });

  // Stage/domain metadata → drives the timeline, landing preview, and form
  // dropdowns so stage names/order never drift across the UI (single source).
  app.get('/api/meta', (_req, res) => {
    res.json({
      stages: stageMeta(),
      stacks: Object.entries(STACKS).map(([key, s]) => ({ key, label: s.label })),
      projectTypes: Object.entries(PROJECT_TYPES).map(([key, value]) => ({ key, label: value })),
      teamSizes: Object.entries(TEAM_SIZES).map(([key, value]) => ({ key, label: value })),
    });
  });

  app.post('/api/plan', async (req, res) => {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket?.remoteAddress || 'local';
    if (isRateLimited(ip)) {
      return res.status(429).json({ ok: false, error: 'Too many runs — take a breather for a minute.' });
    }
    try {
      const input = req.body || {};
      const { results, errors } = await runPipeline(input);
      if (Object.keys(errors).length) console.warn('[api/plan] stage errors:', errors);
      res.json({ ok: true, results, errors });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Pipeline failed. Please try again.' });
    }
  });

  // Background pipeline run: returns a job id at once; the client polls
  // GET /api/jobs/:id for real per-stage progress (same shape Temporal
  // workflow status would stream).
  app.post('/api/jobs', (req, res) => {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket?.remoteAddress || 'local';
    if (isRateLimited(ip)) {
      return res.status(429).json({ ok: false, error: 'Too many runs — take a breather for a minute.' });
    }
    const job = startPipelineJob(req.body || {});
    if (!job) return res.status(429).json({ ok: false, error: 'Run in progress — try again in a moment.' });
    res.json({ ok: true, job: { id: job.id, stages: job.stages } });
  });

  app.get('/api/jobs/:id', (req, res) => {
    const job = getPipelineJob(req.params.id);
    if (!job) return res.status(404).json({ ok: false, error: 'Unknown job id — it may have expired.' });
    res.json({ ok: true, job });
  });

  app.post('/api/export', (req, res) => {
    try {
      const record = req.body;
      if (!record) {
        return res.status(400).json({ ok: false, error: 'Missing record.' });
      }
      const { filename, markdown } = buildBriefMarkdown(record);
      res.json({ ok: true, filename, markdown });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Export failed. Please try again.' });
    }
  });

  // ── Serve the built frontend (production / single-port mode) ─────────────
  app.use(express.static(DIST));

  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(DIST, 'index.html'));
  });

  return app;
}