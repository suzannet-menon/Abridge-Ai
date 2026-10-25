import { getWorkflowStatus } from '../api/client.js';

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason || new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

const TERMINAL_STATUSES = new Set([
  'completed', 'failed', 'canceled', 'cancelled', 'terminated', 'timed_out',
]);

export async function watchWorkflow(workflowId, {
  onProgress,
  signal,
  pollIntervalMs = 1000,
  maxStatusRetries = 5,
  getStatus = getWorkflowStatus,
} = {}) {
  let statusRetries = 0;
  while (true) {
    let snapshot;
    try {
      snapshot = await getStatus(workflowId, { signal });
      statusRetries = 0;
    } catch (error) {
      if (signal?.aborted) throw error;
      const retryable = !error.status || error.status >= 500;
      if (!retryable || statusRetries >= maxStatusRetries) throw error;
      statusRetries += 1;
      await wait(pollIntervalMs, signal);
      continue;
    }

    onProgress?.(snapshot);
    if (TERMINAL_STATUSES.has(snapshot.status)) return snapshot;
    await wait(pollIntervalMs, signal);
  }
}
