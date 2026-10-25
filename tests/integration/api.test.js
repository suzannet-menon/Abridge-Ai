import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../../backend/app.js';
import { STAGE_ORDER } from '../../backend/src/pipeline/stages.js';

// Boots the real Express app factory on an ephemeral port and drives it over
// genuine HTTP — the same surface Vercel wraps, minus the rate-limit
// collision with other test files (each file runs in its own process).

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function startServer(temporalClientFactory) {
  const app = createApp(temporalClientFactory ? { temporalClientFactory } : {});
  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };
  return { call, close: () => new Promise(r => server.close(r)) };
}

test('health + meta expose the single source of truth', async () => {
  const { call, close } = await startServer();
  try {
    const health = await call('GET', '/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.ok, true);

    const meta = await call('GET', '/api/meta');
    assert.equal(meta.data.stages.length, STAGE_ORDER.length);
    assert.deepEqual(meta.data.stages.map(s => s.key), STAGE_ORDER);
    assert.ok(meta.data.stages.some(s => s.key === 'deepdive'), 'meta must include the deep dive');
  } finally { close(); }
});

test('POST /api/plan starts a durable workflow and returns its id at once', async () => {
  let started;
  const fakeClient = {
    workflow: { start: async (type, options) => { started = { type, options }; } },
  };
  const { call, close } = await startServer(async () => fakeClient);
  try {
    const res = await call('POST', '/api/plan', { name: 'api test', idea: 'cli note taker', stack: 'python' });
    assert.equal(res.status, 202);
    assert.equal(res.data.ok, true);
    assert.equal(res.data.status, 'running');
    assert.match(res.data.workflowId, /^abridgeai-/);
    assert.equal(started.options.taskQueue, 'abridgeai-planning');
  } finally { close(); }
});

test('POST /api/plan reports 503 when Temporal is unreachable', async () => {
  const { call, close } = await startServer(async () => { throw new Error('offline'); });
  try {
    const res = await call('POST', '/api/plan', { name: 'api test', idea: 'cli note taker' });
    assert.equal(res.status, 503);
    assert.equal(res.data.ok, false);
  } finally { close(); }
});

test('GET /api/workflows/:id surfaces durable progress and results', async () => {
  const fakeClient = {
    workflow: {
      getHandle: () => ({
        describe: async () => ({ status: { name: 'RUNNING' } }),
        query: async () => ({ stages: { github: 'completed', research: 'running' }, results: { github: { text: 'x' } }, errors: {} }),
      }),
    },
  };
  const { call, close } = await startServer(async () => fakeClient);
  try {
    const res = await call('GET', '/api/workflows/abridgeai-test-id');
    assert.equal(res.status, 200);
    assert.equal(res.data.ok, true);
    assert.equal(res.data.status, 'running');
    assert.ok(res.data.stages.github === 'completed');
  } finally { close(); }
});

test('POST /api/jobs + GET job polls to a complete run', async () => {
  const { call, close } = await startServer();
  try {
    const start = await call('POST', '/api/jobs', { name: 'job test', idea: 'todo cli', stack: 'typescript' });
    assert.equal(start.status, 200);
    assert.ok(start.data.job.id);

    const seenRunning = { v: false };
    const deadline = Date.now() + 60_000;
    let job;
    for (;;) {
      const poll = await call('GET', `/api/jobs/${start.data.job.id}`);
      assert.equal(poll.status, 200);
      job = poll.data.job;
      if (Object.values(job.stages).includes('running')) seenRunning.v = true;
      if (job.status === 'complete') break;
      if (Date.now() > deadline) throw new Error('job did not complete in time');
      await sleep(150);
    }
    for (const key of STAGE_ORDER) assert.equal(job.stages[key], 'done');
    assert.ok(job.results?.brief, 'completed payload carries results');
  } finally { close(); }
});

test('rate limiter returns 429 past the per-minute cap', async () => {
  const factoryFriendly = async () => ({ workflow: { start: async () => {} } });
  const { call, close } = await startServer(factoryFriendly);
  try {
    const statuses = [];
    for (let i = 0; i < 8; i++) {
      const res = await call('POST', '/api/plan', { idea: `rate test ${i}` });
      statuses.push(res.status);
    }
    // Prior tests in the same process share the limiter bucket, so exact
    // counts vary — what must hold: the cap exists AND some runs succeed.
    assert.ok(statuses.includes(429), `expected a 429 within 8 rapid runs, got ${statuses.join(',')}`);
    assert.ok(statuses.filter(s => s === 202).length >= 3, 'several runs allowed before the cap');
  } finally { close(); }
});
