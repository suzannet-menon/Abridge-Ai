# 06 · Builder — the plan + scaffold agent

**File:** `backend/src/agents/builderAgent.js` (+ the generator in
`backend/src/scaffold/scaffold.js`) · **Registry entry:** `builder` (index 6)
**Type: hybrid — LLM writes the milestone narrative; the scaffold files are
100% deterministic and never touched by a model.**

## What it does

Two deliverables:
1. **Milestones** — 4 stages with titles, 2–4 tasks each, and an explicit
   "done-when" acceptance condition, plus a 2–3 sentence build overview.
2. **The starter repo (.zip)** — real, runnable files: entry point, pure core
   module with the plan context as header comments, multiple unit tests,
   `fixtures/sample-input.txt`, tsconfig/pyproject/go.mod/Cargo.toml as
   appropriate, README.md with install/run/test tables, PLAN.md, and
   `index.html` (visual overview page).

## Why the split between AI and deterministic matters

LLMs are unreliable at emitting files. So the scaffold is always produced by
`scaffoldFiles()` — same input, same zip, tests already green, escape-safe
HTML. The model only shapes the *plan around* the artifacts. This is why the
zip downloads even on a fully-degraded run: the deterministic engine carries the
whole deliverable, the LLM just personalizes the roadmap.

## How it works

- **Prompt** (`buildBuilderPrompt`): reads research direction, architecture
  shape/modules, feasibility verdict, stack label. Enforces: exactly 4 numbered
  milestones, ≥1 architecture module named per milestone, project-specific
  titles (never generic "Foundation/Core/Harden/Ship"), and the stack hard
  constraint. Deadline-aware sizing: ≤14 days → **"Day 1–2" ranges** via
  `milestoneSlots`; otherwise weeks.
- **Normalization** (`normalizeMilestones`): keep every valid milestone the model
  returns, fix week numbers, pad missing ones from deterministic templates — a
  single malformed milestone never nukes the whole plan.
- **Scaffold**: language routed via stage 5; `planContext` embeds shape/modules/
  principles into the starter file headers so the "first slice" (`run()`/`Run()`
  normalizing input) is already wired and testable.

## Inputs / outputs

- In: `ctx` (all upstream results), `input.deadline`.
- Out: `{ overview, milestones[4], files[], text, mode }` — `files` is zipped
  client-side (`utils/zip.js`, fflate) for download.

## Failure behavior

No providers → deterministic overview + template milestones that still name the
architecture's core module. The download button still works; milestones just
read safely generic with honest badges.
