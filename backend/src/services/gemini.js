import { fetchWithTimeout } from '../utils/fetchTimeout.js';

const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
// The key travels in the x-goog-api-key header, never the URL, so it can't
// leak into proxy/server logs.
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function parseJson(raw) {
  if (!raw) return null;
  const cleaned = String(raw)
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '');
  try { return JSON.parse(cleaned); } catch { return null; }
}

/**
 * Gemini stage call for any stage. Returns
 *   { ok: true, data: <parsed JSON> }
 *   { ok: false, error: <reason> }
 * The orchestrator (llm.js) owns cross-provider caching and fallback.
 */
export async function runGeminiStage(prompt) {
  if (!API_KEY) return { ok: false, data: null, error: 'no GEMINI_API_KEY' };

  try {
    const res = await fetchWithTimeout(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          responseMimeType: 'application/json',
        },
      }),
    });
    if (!res.ok) {
      console.error(`[gemini] ${MODEL} API ${res.status}:`, await res.text().catch(() => ''));
      return { ok: false, data: null, error: `gemini HTTP ${res.status}` };
    }
    const data = await res.json();
    const raw = (data?.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || '')
      .join('');
    const parsed = parseJson(raw);
    if (!parsed) return { ok: false, data: null, error: 'gemini returned unparseable JSON' };
    return { ok: true, data: parsed, error: null };
  } catch (err) {
    console.error('[gemini] request failed:', err);
    return { ok: false, data: null, error: err?.name === 'AbortError' ? 'gemini timed out' : 'gemini request failed' };
  }
}