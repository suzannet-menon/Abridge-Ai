const HISTORY_KEY = 'abridgeai.history.v1';
const DRAFT_KEY = 'abridgeai.draft.v1';
const THEME_KEY = 'abridgeai.theme.v1';
const LAST_WORKFLOW_KEY = 'abridgeai.last-workflow.v1';

// ── Record versioning ────────────────────────────────────────────────────────
// Bump this when the saved-record schema gains new required fields.
// normalize() must handle every older version up to (RECORD_VERSION - 1).
export const RECORD_VERSION = 1;

/**
 * Upgrade an older record to the current schema.
 * Pure function — no agent calls, no side effects.
 * Safe to apply to any record, including ones already at the current version.
 */
export function normalize(record) {
  // Records written before versioning was introduced have no version field.
  const version = record.version ?? 0;

  let outputs = record.outputs ? { ...record.outputs } : record.outputs;

  if (outputs) {
    // v0 → v1: feasibility.axes was added later; default to [] so the axes
    // chart renders an empty list rather than crashing.
    if (outputs.feasibility && !Array.isArray(outputs.feasibility.axes)) {
      outputs = {
        ...outputs,
        feasibility: { ...outputs.feasibility, axes: [] },
      };
    }

    // v0 → v1: brief was stored as a plain string; wrap it so all consumers
    // see an object with at least a .text field.
    if (outputs.brief && typeof outputs.brief === 'string') {
      outputs = { ...outputs, brief: { text: outputs.brief } };
    }

    // structured-IO migration: research/architecture/stack were stored as plain
    // text before the agents returned { ..., text }; wrap so consumers can
    // always read `.text`.
    ['research', 'architecture', 'stack'].forEach(k => {
      if (outputs[k] && typeof outputs[k] === 'string') {
        outputs = { ...outputs, [k]: { text: outputs[k] } };
      }
    });
  }

  return { ...record, version: Math.max(version, RECORD_VERSION), outputs };
}

// ── History ──────────────────────────────────────────────────────────────────
export function readHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    // Normalize every record on the way out so the rest of the app always
    // sees the current schema, regardless of when the record was written.
    return raw.map(normalize);
  } catch { return []; }
}

export function writeHistory(items) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); }
  catch { /* ignore */ }
}

export function saveToHistory(record) {
  // Stamp the current schema version before persisting.
  const stamped = { ...record, version: RECORD_VERSION };
  const items = readHistory();
  items.unshift(stamped);
  writeHistory(items.slice(0, 12));
}

export function deleteFromHistory(id) {
  writeHistory(readHistory().filter(it => it.id !== id));
}

export function clearHistory() {
  writeHistory([]);
}

export function readLastWorkflow() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_WORKFLOW_KEY));
    return saved?.workflowId && saved?.input ? saved : null;
  } catch {
    return null;
  }
}

export function saveLastWorkflow(workflow) {
  try { localStorage.setItem(LAST_WORKFLOW_KEY, JSON.stringify(workflow)); }
  catch { /* ignore */ }
}
export function clearLastWorkflow() {
  try { localStorage.removeItem(LAST_WORKFLOW_KEY); }
  catch { /* ignore */ }
}

// ── Draft autosave ───────────────────────────────────────────────────────────
export function writeDraft(data) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); }
  catch { /* ignore */ }
}

export function readDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); }
  catch { return null; }
}

export function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); }
  catch { /* ignore */ }
}

// ── Theme ────────────────────────────────────────────────────────────────────
export function readTheme() {
  try { return localStorage.getItem(THEME_KEY); }
  catch { return null; }
}

export function writeTheme(mode) {
  try { localStorage.setItem(THEME_KEY, mode); }
  catch { /* ignore */ }
}

export function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark' : 'light';
}
