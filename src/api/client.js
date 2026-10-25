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

/** Start a durable planning workflow. Resolves { workflowId } on success (HTTP 202). */
export function runPlan(input) {
  return post('/api/plan', input);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Start an in-process background pipeline run. Resolves { id, stages } or throws. */
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

/** Retrieve durable workflow status and its latest stage results. */
export async function getWorkflowStatus(workflowId, { signal } = {}) {
  const res = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}`, { signal });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    const error = new Error(data?.error || 'Workflow status request failed.');
    error.status = res.status;
    throw error;
  }
  return data;
}

/** Ask the backend to render a saved record as a downloadable markdown brief. */
export function exportBrief(record) {
  return post('/api/export', record);
}