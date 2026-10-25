export const LLM_TIMEOUT_MS = 20_000;
export const GITHUB_TIMEOUT_MS = 10_000;

/** fetch() with a hard abort deadline so a hung provider never stalls the request. */
export function fetchWithTimeout(url, options = {}, timeoutMs = LLM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}
