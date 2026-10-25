import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../../backend/app.js';
import { STAGE_ORDER } from '../../backend/src/pipeline/stages.js';

// Boots the real Express app factory on an ephemeral port and drives it over
// genuine HTTP — the same surface Vercel wraps, minus the rate-limit
// collision with other test files (each file runs in its own process).

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function startServer() {
  const server = http.createServer(createApp());
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

test('POST /api/plan returns a full run of results', async () => {
  const { call, close } = await startServer();
  try {
    const res = await call('POST', '/api/plan', { name: 'api test', idea: 'cli note taker', stack: 'python' });
    assert.equal(res.status, 200);
    assert.equal(res.data.ok, true);
    for (const key of STAGE_ORDER) assert.ok(res.data.results[key], `missing ${key}`);
    assert.equal(res.data.results.feasibility.score >= 0, true);
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
  const { call, close } = await startServer();
  try {
    const statuses = [];
    for (let i = 0; i < 8; i++) {
      const res = await call('POST', '/api/plan', { idea: `rate test ${i}` });
      statuses.push(res.status);
    }
    // Prior tests in the same process share the limiter bucket, so exact
    // counts vary — what must hold: the cap exists AND some runs succeed.
    assert.ok(statuses.includes(429), `expected a 429 within 8 rapid runs, got ${statuses.join(',')}`);
    assert.ok(statuses.filter(s => s === 200).length >= 3, 'several runs allowed before the cap');
  } finally { close(); }
});
