import { fetchWithTimeout, LLM_TIMEOUT_MS } from '../utils/fetchTimeout.js';

const API_KEY = process.env.JARVISLABS_API_KEY || '';
const MODEL = process.env.JARVISLABS_MODEL || 'glm-5.3';
const ENDPOINT = 'https://models.jarvislabs.net/v1/chat/completions';

function parseJson(raw) {
  if (!raw) return null;
  const cleaned = String(raw)
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '');
  try { return JSON.parse(cleaned); } catch { return null; }
}

/**
 * Jarvislabs Token Factory stage call (OpenAI-compatible, open models).
 * Returns
 *   { ok: true, data: <parsed JSON> }
 *   { ok: false, error: <reason> }
 * Used as the deep-dive provider and as a later link of the LLM chain.
 */
export async function runJarvislabsStage(prompt) {
  if (!API_KEY) return { ok: false, data: null, error: 'no JARVISLABS_API_KEY' };

  async function attempt(withJsonMode) {
    const body = {
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    };
    if (withJsonMode) body.response_format = { type: 'json_object' };

    const res = await fetchWithTimeout(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    }, LLM_TIMEOUT_MS);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { status: res.status, body: text, retry: withJsonMode && res.status === 400 };
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? '';
    const parsed = parseJson(raw);
    if (!parsed) return { status: 200, body: raw, retry: false, unparsed: true };
    return { status: 200, body: raw, retry: false, parsed };
  }

  try {
    const first = await attempt(true);
    if (first.retry) {
      const second = await attempt(false);
      if (second.parsed) return { ok: true, data: second.parsed, error: null };
      return { ok: false, data: null, error: `jarvislabs HTTP ${second.status}${second.unparsed ? ' (unparseable JSON)' : ''}` };
    }
    if (first.parsed) return { ok: true, data: first.parsed, error: null };
    if (first.unparsed) return { ok: false, data: null, error: 'jarvislabs returned unparseable JSON' };
    return { ok: false, data: null, error: `jarvislabs HTTP ${first.status}` };
  } catch (err) {
    console.error('[jarvislabs] request failed:', err);
    return { ok: false, data: null, error: err?.name === 'AbortError' ? 'jarvislabs timed out' : 'jarvislabs request failed' };
  }
}
