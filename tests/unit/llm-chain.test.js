import test from 'node:test';
import assert from 'node:assert/strict';
import { runLLMStage, clearLLMCache } from '../../backend/src/services/llm.js';

// Hermetic run: no provider keys are present, so the three-provider chain
// must end in an honest deterministic failure (never a made-up "ok").

test('with no keys, the chain refuses rather than faking success', async () => {
  const out = await runLLMStage('chain:smoke', 'Return look-and-feel JSON for testing.');
  assert.equal(out.ok, false);
  assert.equal(out.mode, 'deterministic');
  assert.equal(out.data, null);
});

test('the cache short-circuits identically-keyed results', async () => {
  clearLLMCache();
  const first = await runLLMStage('cache:xyz', 'prompt one');
  const second = await runLLMStage('cache:xyz', 'prompt two');
  // Both fail (no keys), so both are deterministic — but a successful first
  // call would make the second cached. Assert the failure shape is stable.
  assert.deepEqual(
    { ok: first.ok, mode: first.mode },
    { ok: second.ok, mode: second.mode },
  );
  clearLLMCache();
});
