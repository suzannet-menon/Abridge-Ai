import test from 'node:test';
import assert from 'node:assert/strict';
import { startPipelineJob, getPipelineJob } from '../../backend/src/jobs.js';
import { STAGE_ORDER } from '../../backend/src/pipeline/stages.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runToCompletion(input, timeoutMs = 60_000) {
  const started = startPipelineJob(input);
  assert.ok(started?.id, 'job should start with an id');
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const job = getPipelineJob(started.id);
    if (job.status === 'complete') return job;
    if (Date.now() > deadline) throw new Error('job did not finish in time');
    await sleep(120);
  }
}

test('a background job runs all registered stages to a terminal state', async () => {
  const job = await runToCompletion({ name: 't', idea: 'cli note taker', stack: 'python' });

  for (const key of STAGE_ORDER) {
    assert.ok(['done', 'error'].includes(job.stages[key]), `stage ${key} must finish (got ${job.stages[key]})`);
    // hermetic run: every stage should legitimately complete via fallbacks
    assert.equal(job.stages[key], 'done');
  }
  assert.equal(job.status, 'complete');
  assert.ok(job.finishedAt >= job.startedAt);
});

test('job results carry every stage key incl. deepdive', async () => {
  const job = await runToCompletion({ name: 't', idea: 'todo cli', stack: 'typescript' });
  for (const key of STAGE_ORDER) {
    assert.ok(job.results[key], `results.${key} must be populated`);
  }
  assert.ok(job.results.feasibility.score >= 0 && job.results.feasibility.score <= 100);
});

test('stageErrors travels with the completed payload', async () => {
  const job = await runToCompletion({ name: 't', idea: 'x', stack: 'python' });
  assert.equal(typeof job.stageErrors, 'object');
});

test('unknown job ids answer null (route turns that into a 404)', () => {
  assert.equal(getPipelineJob('does_not_exist'), null);
});
