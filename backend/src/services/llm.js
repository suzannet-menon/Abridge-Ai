import { hash } from '../utils/hash.js';
import { runGeminiStage } from './gemini.js';
import { runGroqStage } from './groq.js';
import { runJarvislabsStage } from './jarvislabs.js';

// In-process cache keyed by a stage seed so identical inputs are never
// re-billed and repeat runs stay deterministic for the same cache lifetime.
const cache = new Map();

/**
 * Modes explain where a stage's content came from, so the UI can label it:
 * - 'llm'           fresh Gemini generation for this input
 * - 'groq'          fresh Groq generation — Gemini failed or absent
 * - 'jarvislabs'    fresh Jarvislabs (Token Factory) generation — earlier links failed
 * - 'cached-llm'    result reused from this process's cache
 * - 'deterministic' all providers failed → bundled agent
 */
export const MODE = { LLM: 'llm', GROQ: 'groq', JARVISLABS: 'jarvislabs', CACHED: 'cached-llm', DETERMINISTIC: 'deterministic' };

function fail() {
  return { ok: false, data: null, mode: MODE.DETERMINISTIC };
}

/**
 * Provider-first stage runner: Gemini → Groq → Jarvislabs → deterministic fallback.
 * Returns
 *   { ok: true,  data: <parsed JSON>, mode: 'llm' | 'groq' | 'jarvislabs' | 'cached-llm' }
 *   { ok: false, data: null,          mode: 'deterministic' }
 * Callers fall back to their bundled deterministic logic when ok is false.
 */
export async function runLLMStage(seedKey, prompt) {
  const seed = hash(String(seedKey ?? ''));
  if (cache.has(seed)) return { ok: true, data: cache.get(seed), mode: MODE.CACHED };

  const reasons = [];

  const gemini = await runGeminiStage(prompt);
  if (gemini.ok) {
    cache.set(seed, gemini.data);
    return { ok: true, data: gemini.data, mode: MODE.LLM };
  }
  reasons.push(gemini.error);

  const groq = await runGroqStage(prompt);
  if (groq.ok) {
    cache.set(seed, groq.data);
    return { ok: true, data: groq.data, mode: MODE.GROQ };
  }
  reasons.push(groq.error);

  const jarvislabs = await runJarvislabsStage(prompt);
  if (jarvislabs.ok) {
    cache.set(seed, jarvislabs.data);
    return { ok: true, data: jarvislabs.data, mode: MODE.JARVISLABS };
  }
  reasons.push(jarvislabs.error);

  console.warn(`[llm] all providers failed (${String(seedKey).slice(0, 48)}): ${reasons.join(' | ')}`);
  return fail();
}

export function clearLLMCache() {
  cache.clear();
}