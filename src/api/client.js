async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'Backend request failed.');
  }
  return data;
}

/** Fetch stage/domain metadata (single source of truth lives on the backend). */
export async function getMeta() {
  const res = await fetch('/api/meta');
  if (!res.ok) throw new Error('Meta request failed.');
  const data = await res.json();
  if (!data?.stages) throw new Error('Meta response malformed.');
  return data;
}

/** Run the full planning pipeline on the backend (synchronous fallback). Returns { results, errors }. */
export function runPlan(input) {
  return post('/api/plan', input);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Start a background pipeline run. Resolves { id, stages } or throws. */
export async function startJob(input) {
  const data = await post('/api/jobs', input);
  return data.job;
}

/**
 * Poll /api/jobs/:id until complete, streaming per-stage status to onStage.
 * The timeline flips for real as stages finish — no timer theatre.
 */
export async function pollJob(jobId, onStage, { timeoutMs = 95_000, intervalMs = 700 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Job polling failed.');
    }
    onStage?.(data.job);
    if (data.job.status === 'complete') return data.job;
    if (Date.now() > deadline) throw new Error('Pipeline run timed out.');
    await sleep(intervalMs);
  }
}

/** Ask the backend to render a saved record as a downloadable markdown brief. */
export function exportBrief(record) {
  return post('/api/export', record);
}