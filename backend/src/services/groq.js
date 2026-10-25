import { fetchWithTimeout } from '../utils/fetchTimeout.js';

const API_KEY = process.env.GROQ_API_KEY || '';
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

function parseJson(raw) {
  if (!raw) return null;
  const cleaned = String(raw)
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '');
  try { return JSON.parse(cleaned); } catch { return null; }
}

/**
 * Groq stage call, OpenAI-compatible chat completions. Returns
 *   { ok: true, data: <parsed JSON> }
 *   { ok: false, error: <reason> }
 * The orchestrator (llm.js) calls this only after Gemini fails.
 */
export async function runGroqStage(prompt) {
  if (!API_KEY) return { ok: false, data: null, error: 'no GROQ_API_KEY' };

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
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (withJsonMode && res.status === 400) return { status: res.status, body: text, retry: true };
      console.error(`[groq] ${MODEL} API ${res.status}:`, text);
      return { status: res.status, body: text, retry: false };
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? '';
    const parsed = parseJson(raw);
    if (!parsed) return { status: 200, body: raw, retry: false, unparsed: true };
    return { status: 200, body: raw, retry: false, parsed };
  }

  try {
    // Some Groq models reject response_format; retry once in plain mode and
    // extract JSON from the text instead.
    const first = await attempt(true);
    if (first.retry) {
      const second = await attempt(false);
      if (second.parsed) return { ok: true, data: second.parsed, error: null };
      return { ok: false, data: null, error: `groq HTTP ${second.status}${second.unparsed ? ' (unparseable JSON)' : ''}` };
    }
    if (first.parsed) return { ok: true, data: first.parsed, error: null };
    if (first.unparsed) return { ok: false, data: null, error: 'groq returned unparseable JSON' };
    return { ok: false, data: null, error: `groq HTTP ${first.status}` };
  } catch (err) {
    console.error('[groq] request failed:', err);
    return { ok: false, data: null, error: err?.name === 'AbortError' ? 'groq timed out' : 'groq request failed' };
  }
}