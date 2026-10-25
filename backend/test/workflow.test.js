import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';

const workflowsPath = fileURLToPath(new URL('../src/temporal/workflows.js', import.meta.url));

test('workflow retries a failed activity once and records stage progress', async () => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const attempts = new Map();
  const taskQueue = 'abridgeai-test';
  const worker = await Worker.create({
    connection: env.nativeConnection,
    namespace: env.namespace,
    taskQueue,
    workflowsPath,
    activities: {
      async runPlanningStage({ key }) {
        const count = (attempts.get(key) || 0) + 1;
        attempts.set(key, count);
        if (key === 'github' && count === 1) throw new Error('temporary test failure');
        return { stage: key };
      },
    },
  });

  try {
    const result = await worker.runUntil(() => env.client.workflow.execute('planWorkflow', {
      workflowId: 'abridgeai-retry-test',
      taskQueue,
      args: [{ idea: 'test' }],
    }));

    assert.equal(attempts.get('github'), 2);
    assert.equal(result.status, 'completed');
    assert.equal(result.stages.github, 'completed');
    assert.equal(result.results.github.stage, 'github');
    assert.deepEqual(result.errors, {});
  } finally {
    await env.teardown();
  }
});

test('workflow records an activity error after the bounded retry limit', async () => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const attempts = new Map();
  const taskQueue = 'abridgeai-failure-test';
  const worker = await Worker.create({
    connection: env.nativeConnection,
    namespace: env.namespace,
    taskQueue,
    workflowsPath,
    activities: {
      async runPlanningStage({ key }) {
        const count = (attempts.get(key) || 0) + 1;
        attempts.set(key, count);
        if (key === 'github') throw new Error('persistent test failure');
        return { stage: key };
      },
    },
  });

  try {
    const result = await worker.runUntil(() => env.client.workflow.execute('planWorkflow', {
      workflowId: 'abridgeai-failure-test',
      taskQueue,
      args: [{ idea: 'test' }],
    }));

    assert.equal(attempts.get('github'), 2);
    assert.equal(result.status, 'completed');
    assert.equal(result.stages.github, 'failed');
    assert.equal(result.errors.github, 'persistent test failure');
    assert.equal(result.stages.research, 'completed');
  } finally {
    await env.teardown();
  }
});

test('the existing planning stages execute as Temporal Activities without provider keys', async () => {
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  const previousGroqKey = process.env.GROQ_API_KEY;
  process.env.GEMINI_API_KEY = '';
  process.env.GROQ_API_KEY = '';
  let env;
  try {
    const { runPlanningStage } = await import('../src/temporal/activities.js');
    env = await TestWorkflowEnvironment.createTimeSkipping();
    const taskQueue = 'abridgeai-pipeline-test';
    const worker = await Worker.create({
      connection: env.nativeConnection,
      namespace: env.namespace,
      taskQueue,
      workflowsPath,
      activities: { runPlanningStage },
    });
    const result = await worker.runUntil(() => env.client.workflow.execute('planWorkflow', {
      workflowId: 'abridgeai-pipeline-test',
      taskQueue,
      args: [{
        idea: 'Build a simple task management web application.',
        name: 'Temporal pipeline test',
        stack: 'typescript',
        github: '',
        comfort: 'beginner',
        type: 'web-app',
        team: 'solo',
        deadline: '2 weeks',
        audience: 'small teams',
      }],
    }));

    assert.deepEqual(Object.keys(result.results), [
      'github', 'research', 'feasibility', 'architecture', 'stack', 'builder', 'brief', 'deepdive',
    ]);
    assert.ok(Object.values(result.stages).every(status => status === 'completed'));
    assert.equal(result.results.research.mode, 'deterministic');
    assert.equal(result.errors && Object.keys(result.errors).length, 0);
  } finally {
    if (previousGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGeminiKey;
    if (previousGroqKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousGroqKey;
    await env?.teardown();
  }
});
