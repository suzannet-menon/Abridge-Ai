# 07 · Brief — the canonical brief agent

**File:** `backend/src/agents/briefAgent.js` — with the model in
`backend/src/brief/model.js` and renderers in `brief/render.js`
**Registry entry:** `brief` (index 7)
**Type: hybrid — the brief structure is deterministic; the narrative sections
are LLM-tailored when a provider is available.**

## What it does

Assembles the **Project Brief**: the single document that ties the whole run
together — what the project is, the verdict tone, why this direction, the
milestone plan recap, next steps, and MVP scope guidance. This is the same
object exported as Markdown via `POST /api/export` (`export/markdown.js`).

## Why it's the "syntax check" of the pipeline

`buildBriefModel(ctx)` consumes the *structured* results of stages 1–6 (never
slicing agent text), which guarantees the screen version and the exported
Markdown can't drift apart — one canonical model, two renderers. If anything
upstream was malformed, this stage is where the shape gets judged as coherent.

## How it works

- **Structured part** (`model.js`): collects idea/type/stack, feasibility
  score/verdict, architecture shape/modules, research direction, milestones —
  all directly from `ctx.results`.
- **LLM part** (`buildBriefPrompt`): writes the narrative tail on top:
  - `story` — 4–6 sentences pre-verified against the verdict tone
    (GO reads confident; rethink honest);
  - `nextSteps` — exactly 4 concrete first-actions (≤16 words), stack-locked
    and sized to the deadline;
  - `mvpGuidance` — 2 scope rules anchored to the idea's core deliverable.
- **Render** (`renderText` for the web; `renderMarkdown` for the export).

## Inputs / outputs

- In: `ctx` (uses everything upstream, structured only).
- Out: the canonical brief object `{ ..., story, nextSteps, mvpGuidance, text, mode }`.

## Failure behavior

Providers down → `buildBriefModel(ctx, null)` renders deterministic narrative;
the brief is presentable and exportable either way — the mode badge says which.
