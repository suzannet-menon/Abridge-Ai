import { STAGES, STAGE_ORDER } from './pipeline/stages.js';
import { createContext } from './pipeline/context.js';

/**
 * In-memory job store: the 7+1 stage pipeline run as a background job with
 * real per-stage progress, instead of one 15s synchronous HTTP request.
 * The frontend starts a job, then polls its status and flips the timeline
 * for real as each stage finishes.
 *
 * This is the polling-compatible shape of the Temporal showcase: with
 * Temporal (docker compose, see docker-compose.yml) the same job map is a
 * Workflow Handle — per-activity status, retries and history for free.
 */

const jobs = new Map();
const MAX_CONCURRENT = 2;
const MAX_TRACKED = 40;
let runningCount = 0;

function prune() {
  if (jobs.size <= MAX_TRACKED) return;
  const sorted = [...jobs.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
  for (const [id] of sorted) {
    if (jobs.size <= MAX_TRACKED) break;
    if (jobs.get(id).status !== 'running') jobs.delete(id);
  }
}

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    stages: job.stages,
    stageErrors: job.stageErrors,
    results: job.status === 'complete' ? job.results : null,
    errors: job.status === 'complete' ? job.errors : null,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt ?? null,
  };
}

/**
 * Starts the pipeline in the background. Returns null when the store is at
 * its concurrency cap (the caller answers 429 and the client can fall back
 * to sync /api/plan).
 */
export function startPipelineJob(input) {
  if (runningCount >= MAX_CONCURRENT) return null;

  const id = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    status: 'running',
    stages: Object.fromEntries(STAGE_ORDER.map(k => [k, 'queued'])),
    stageErrors: {},
    results: null,
    errors: null,
    createdAt: Date.now(),
    startedAt: Date.now(),
    finishedAt: null,
  };
  jobs.set(id, job);
  prune();
  runningCount += 1;

  void (async () => {
    const ctx = createContext(input);
    for (const key of STAGE_ORDER) {
      const stage = STAGES[key];
      if (!stage) {
        job.stageErrors[key] = `Unknown stage "${key}"`;
        job.stages[key] = 'error';
        continue;
      }
      job.stages[key] = 'running';
      try {
        ctx.results[key] = await stage.run(ctx);
        job.stages[key] = 'done';
      } catch (err) {
        job.stages[key] = 'error';
        job.stageErrors[key] = err?.message || String(err);
        console.error(`[job ${id}] stage "${key}" failed:`, err);
      }
    }
    job.results = ctx.results;
    job.errors = ctx.errors;
    job.status = 'complete';
    job.finishedAt = Date.now();
    runningCount -= 1;
  })();

  return publicJob(job);
}

export function getPipelineJob(id) {
  const job = jobs.get(String(id));
  return job ? publicJob(job) : null;
}
