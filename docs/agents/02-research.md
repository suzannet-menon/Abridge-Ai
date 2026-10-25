# 02 · Research — the opportunity-scan agent

**File:** `backend/src/agents/researchAgent.js` · **Registry entry:** `research` (index 2)
**Type: LLM-capable (buildResearchPrompt) with a full deterministic fallback.**

## What it does

Produces a short, idea-specific research brief: exactly **3 opportunities,
3 risks, 2 directions, 1 builder signal**. It is the "outside view": what's
the opening, what kills projects like this, which direction to start from.

## Why it's second

Everything downstream quotes it. The architecture stage reads
`research.directions[0]` ("Research direction already found"), and the brief
stage quotes the research signal in the story section. Feeding a vague brief
forward is how the whole plan becomes generic — hence the strictness.

## How it works

- **Prompt** (`buildResearchPrompt`): carries the idea, type, audience, deadline,
  comfort, chosen stack and the builder's top GitHub languages from stage 1.
  Inlines a strict JSON shape and hard rules: exact counts, items must reference
  *this* idea (max 24 words), forbidden filler phrases ("build a vertical
  slice", "scope carefully"...), and **STACK IS A HARD CONSTRAINT** — the model
  must never suggest a different language family.
- **Chain**: Gemini → Groq → Jarvislabs → on failure, deterministic picks
  (`hash`/`pick`) from curated opportunity/risk/direction pools included in the
  agent file — 12 opportunities, 10 risks, 8 directions.
- **Normalization** (`normalize`): clamps arrays to the exact counts, pads from
  deterministic pools when the model returns too few, keeps valid items when it
  returns too many, and synthesizes a builderSignal from GitHub stats if the
  model omits one.

## Inputs / outputs

- In: `ctx.input`, `ctx.results.github` (languages + profile).
- Out: `{ opportunities[3], risks[3], directions[2], builderSignal, text, mode }`
  — `text` is the rendered card body; `mode` is the provenance badge.

## Failure behavior

Providers fail or return garbage → the pools fill in. The card still shows the
right shape; only the spark is reduced. Watch the mode badge to tell them apart.
