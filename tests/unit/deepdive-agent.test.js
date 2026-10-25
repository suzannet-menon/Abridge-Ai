import test from 'node:test';
import assert from 'node:assert/strict';
import { runDeepDiveAgent } from '../../backend/src/agents/deepDiveAgent.js';

// Run without any API keys in the environment (plain `npm test` never loads
// .env), so this exercises the deterministic fallback path end to end.

const CTX = {
  input: { name: 'Su', idea: 'cli note taker', stack: 'python', type: 'cli', deadline: '2 weeks' },
  results: {
    architecture: { modules: ['note ingestion', 'core', 'cli'], shape: 'ingest -> normalize -> write', principles: ['pure core'] },
    feasibility: { score: 66, verdict: 'Proceed with caution', verdictClass: 'warn', estimate: '10 days' },
    stack: { label: 'Python' },
    research: { risks: ['parsing varies by hand'] },
  },
};

test('deep dive always returns the full card shape', async () => {
  const d = await runDeepDiveAgent(CTX);
  assert.ok(Array.isArray(d.moduleNotes) && d.moduleNotes.length >= 1);
  assert.ok(Array.isArray(d.extraTests) && d.extraTests.length >= 1);
  assert.ok(Array.isArray(d.pitfalls) && d.pitfalls.length >= 1);
  assert.ok(Array.isArray(d.nextMoves) && d.nextMoves.length >= 1);
  assert.equal(typeof d.text, 'string');
  assert.ok(d.text.length > 40);
  for (const m of d.moduleNotes) {
    assert.equal(typeof m.name, 'string');
    assert.ok(String(m.note).length > 10);
  }
});

test('deterministic fallback labels its provenance honestly', async () => {
  const d = await runDeepDiveAgent(CTX);
  // With no keys anywhere in the chain, the agent must own up to it.
  assert.equal(d.mode, 'deterministic');
});

test('module notes stay grounded in the architecture output', async () => {
  const d = await runDeepDiveAgent(CTX);
  const archNames = new Set(CTX.results.architecture.modules.map(n => n.toLowerCase()));
  const coreMentioned = d.moduleNotes.some(m => archNames.has(String(m.name).toLowerCase()));
  assert.ok(coreMentioned, 'fallback notes must reference architecture modules');
});
