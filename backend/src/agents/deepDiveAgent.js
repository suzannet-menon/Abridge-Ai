import { runJarvislabsStage } from '../services/jarvislabs.js';
import { runLLMStage, MODE } from '../services/llm.js';
import { buildDeepDivePrompt } from '../prompts/prompts.js';

const clamp = (arr, n) => (Array.isArray(arr) ? arr.slice(0, n) : []);

function normalize(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.moduleNotes)) return null;
  const moduleNotes = clamp(data.moduleNotes, 4)
    .filter(m => m && typeof m.name === 'string' && typeof m.note === 'string' && m.note.trim());
  if (!moduleNotes.length) return null;
  return {
    moduleNotes,
    extraTests: clamp(data.extraTests, 3).filter(t => typeof t === 'string' && t.trim()),
    pitfalls: clamp(data.pitfalls, 2).filter(p => typeof p === 'string' && p.trim()),
    nextMoves: clamp(data.nextMoves, 2).filter(n => typeof n === 'string' && n.trim()),
  };
}

function renderText(d) {
  const lines = [`MODULE NOTES`, ''];
  d.moduleNotes.forEach(m => lines.push(`${m.name}`, `  ${m.note}`, ''));
  if (d.extraTests.length) {
    lines.push('TESTS TO ADD');
    d.extraTests.forEach(t => lines.push(`  + ${t}`));
    lines.push('');
  }
  if (d.pitfalls.length) {
    lines.push('PITFALLS');
    d.pitfalls.forEach(p => lines.push(`  ! ${p}`));
    lines.push('');
  }
  if (d.nextMoves.length) {
    lines.push('NEXT MOVES');
    d.nextMoves.forEach(n => lines.push(`  > ${n}`));
  }
  return lines.join('\n').replace(/\n{3,}$/, '\n');
}

/** Deterministic handover content so the card always renders (LLM absent/failed). */
function deterministicDeepDive(ctx) {
  const r = ctx?.results || {};
  const arch = r.architecture || {};
  const modules = Array.isArray(arch.modules) && arch.modules.length
    ? arch.modules : ['entry', 'core', 'output'];
  const shape = arch.shape || 'input -> parse -> transform -> output';
  const stackLabel = r.stack?.label || ctx?.input?.customStack || 'the chosen stack';
  const risks = (r.research?.risks || []).slice(0, 2);

  const coreIdx = modules.findIndex(m => /core|domain|engine/i.test(String(m)));
  const notes = modules.slice(0, 4).map((m, i) => ({
    name: m,
    note: i === coreIdx
      ? `This is the pure center of the pipeline (${shape}). Keep it free of I/O and \
cover it with fixed-fixture tests before you grow it — everything else is an adapter.`
      : `An adapter around the core. Implement it with ${stackLabel} standard tooling first, \
keep its interface narrow, and let it fail loudly when input contracts break.`,
  }));

  const extraTests = [
    `End-to-end: run the entry point on fixtures/sample-input.txt and assert the exact output.`,
    `Edge: feed an empty / whitespace-only input and assert a clear, non-crashing result.`,
  ];

  const pitfalls = risks.length
    ? risks.map(r2 => `Watch for: ${r2}. Budget a spike to de-risk it inside the first milestone.`)
    : ['Watch for: scope creep past the first milestone. Ship the end-to-end slice before polishing.'];

  const nextMoves = [
    'Implement the first pipeline step in the core module and make the bundled tests green.',
    'Re-run the plan in AbridgeAI after the first slice lands to re-score feasibility.',
  ];

  const d = { moduleNotes: notes, extraTests, pitfalls, nextMoves };
  return { ...d, text: renderText(d), mode: MODE.DETERMINISTIC };
}

/**
 * Deep Dive stage (8th). Jarvislabs-first: Token Factory open models do the
 * long-form, in-depth generation. Falls back to the shared LLM chain, then to
 * a deterministic handover doc so the card always renders.
 */
export async function runDeepDiveAgent(ctx) {
  const input = ctx?.input || {};
  const seedKey = (input.idea || '') + '|deepdive';

  const direct = await runJarvislabsStage(buildDeepDivePrompt(ctx));
  if (direct.ok) {
    const d = normalize(direct.data);
    if (d) return { ...d, text: renderText(d), mode: MODE.JARVISLABS };
    console.warn('[deepdive] jarvislabs returned unusable shape; falling back to chain');
  }

  const chain = await runLLMStage('deepdive:' + seedKey, buildDeepDivePrompt(ctx));
  if (chain.ok) {
    const d = normalize(chain.data);
    if (d) return { ...d, text: renderText(d), mode: chain.mode };
  }

  return deterministicDeepDive(ctx);
}
