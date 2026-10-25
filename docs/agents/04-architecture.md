# 04 · Architecture — the blueprint agent

**File:** `backend/src/agents/architectureAgent.js` · **Registry entry:** `architecture` (index 4)
**Type: LLM-capable (buildArchitecturePrompt) with a deterministic fallback.**

## What it does

Designs the skeleton of the project: a one-line **data-flow shape** (e.g.
`ingest → normalize → generate → deliver`), exactly **4 named modules**, a
one-line **flow description**, and **3 design principles** tied to the idea's
risks. The shape rule: *one module is a pure deterministic "core" holding all
business logic; the rest are thin adapters.*

## Why it matters downstream

- The scaffold's header comments embed the shape + modules (what you see in
  `core.ts`/`core.py` when you unzip).
- The builder prompt requires every milestone to name at least one of these
  modules — this is what makes milestones concrete.
- The scaffold's `index.html` renders the shape as the "data-flow spine" and
  the modules as the module map.
- The fallback pool even carries type-specific shapes (web-app →
  `request → validate → execute → persist → respond`).

## How it works

- **Prompt**: idea + type + audience + deadline + comfort + the research
  direction from stage 2 (`research.directions[0]`). Strict JSON shape with the
  4/1/3/1 counts; module names must be derived from the idea ("inventory
  adapter", not "core / domain logic").
- **Chain**: Gemini → Groq → Jarvislabs → fallback (`deterministicParts`):
  seeded pick of 4 modules from a 12-module pool, seeded flow, top principles.
- **Normalization**: shape is sanitized (arrows normalized), modules clamped to 4,
  principles to 3; invalid sets fall through to the pool version.

## Inputs / outputs

- In: `ctx.input`, reads `ctx.results.research`.
- Out: `{ shape, modules[4], flow, principles[3], text, mode }`.

## Failure behavior

LLM absent/failed → pool-based blueprint with the type-appropriate shape.
Result: plausible, generic-adjacent — the UI badge (`fallback`) is the honesty signal.
