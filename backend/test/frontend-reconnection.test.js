import assert from 'node:assert/strict';
import test from 'node:test';
import { readLastWorkflow, saveLastWorkflow } from '../../src/utils/storage.js';
import { watchWorkflow } from '../../src/utils/workflow.js';

test('saved workflow ID and input can be restored after a page refresh', t => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const workflow = {
    workflowId: 'abridgeai-refresh-test',
    input: { idea: 'A simple task management web application.' },
  };

  saveLastWorkflow(workflow);
  assert.deepEqual(readLastWorkflow(), workflow);
  t.after(() => delete globalThis.localStorage);
});

test('watchWorkflow reconnects by ID and returns the durable result', async () => {
  const snapshots = [
    { status: 'running', stages: { github: 'running' }, results: {}, errors: {} },
    { status: 'completed', stages: { github: 'completed' }, results: { github: { text: 'done' } }, errors: {} },
  ];
  const received = [];
  const result = await watchWorkflow('abridgeai-refresh-test', {
    pollIntervalMs: 1,
    getStatus: async workflowId => {
      assert.equal(workflowId, 'abridgeai-refresh-test');
      return snapshots.shift();
    },
    onProgress: snapshot => received.push(snapshot.status),
  });

  assert.deepEqual(received, ['running', 'completed']);
  assert.equal(result.results.github.text, 'done');
});

test('watchWorkflow retries temporary status-service failures while reconnecting', async () => {
  let requests = 0;
  const result = await watchWorkflow('abridgeai-reconnect-test', {
    pollIntervalMs: 1,
    getStatus: async () => {
      requests += 1;
      if (requests === 1) throw Object.assign(new Error('worker query not ready'), { status: 503 });
      return { status: 'completed', stages: {}, results: {}, errors: {} };
    },
  });

  assert.equal(requests, 2);
  assert.equal(result.status, 'completed');
});
