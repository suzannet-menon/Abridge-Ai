import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from '../app.js';
import { PLAN_PROGRESS_QUERY, PLAN_WORKFLOW_TYPE } from '../src/temporal/workflowConstants.js';
import { TEMPORAL_TASK_QUEUE } from '../src/temporal/config.js';

async function listen(app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

test('POST /api/plan starts a workflow and returns its ID without waiting for results', async t => {
  let started;
  const client = {
    workflow: {
      start: async (workflowType, options) => { started = { workflowType, options }; },
    },
  };
  const { server, baseUrl } = await listen(createApp({ temporalClientFactory: async () => client }));
  t.after(() => server.close());
  const input = { idea: 'A simple task management web application.' };

  const response = await fetch(`${baseUrl}/api/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(body.status, 'running');
  assert.match(body.workflowId, /^abridgeai-/);
  assert.equal(started.workflowType, PLAN_WORKFLOW_TYPE);
  assert.equal(started.options.taskQueue, TEMPORAL_TASK_QUEUE);
  assert.deepEqual(started.options.args, [input]);
});

test('GET /api/workflows/:workflowId returns persisted progress and results', async t => {
  const progress = {
    stages: { github: 'completed', research: 'running' },
    results: { github: { text: 'sample output' } },
    errors: {},
  };
  const client = {
    workflow: {
      getHandle: id => ({
        describe: async () => ({ status: { name: 'RUNNING' } }),
        query: async queryName => {
          assert.equal(id, 'abridgeai-existing');
          assert.equal(queryName, PLAN_PROGRESS_QUERY);
          return progress;
        },
      }),
    },
  };
  const { server, baseUrl } = await listen(createApp({ temporalClientFactory: async () => client }));
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/workflows/abridgeai-existing`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    workflowId: 'abridgeai-existing',
    status: 'running',
    ...progress,
  });
});

test('Temporal connection failure is reported as service unavailable', async t => {
  const { server, baseUrl } = await listen(createApp({
    temporalClientFactory: async () => { throw new Error('offline'); },
  }));
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea: 'test' }),
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
});
