# 08 · Deep Dive — the Jarvislabs handover agent

**File:** `backend/src/agents/deepDiveAgent.js` · **Registry entry:** `deepdive` (index 8)
**Type: LLM-capable, **Jarvislabs-first** — Token Factory open models do the
in-depth long-form generation; falls back to the shared chain, then deterministic.**

## What it does

Runs *after* the brief, reading everything the pipeline produced, and goes one
level deeper for handover:

- **moduleNotes** — one entry per architecture module: what it does, the tricky
  part, how to implement it in the chosen stack;
- **extraTests** — 3 concrete runnable tests (fixture/function/behavior named);
- **pitfalls** — 2, tied to the research stage's risks (not generic advice);
- **nextMoves** — 2 ordered first actions after milestone 1.

## Why it exists and why Jarvislabs

Stages 2–7 answer *what to build*. The deep dive answers *"okay, now how do I
actually build it"* — the mentoring layer. Jarvislabs Token Factory
(`models.jarvislabs.net/v1`, OpenAI-compatible, models like GLM-5.3 /
DeepSeek V4 Flash) is called **directly first** (`runJarvislabsStage`) because
it is the dedicated depth provider: cheap per-token long-form reasoning on open
models. If it fails, the ordinary chain (Gemini → Groq → Jarvislabs) still tries,
and if that fails too, the deterministic handover kicks in.

## How it works

1. `buildDeepDivePrompt(ctx)` prints the whole project state: idea, stack,
   feasibility + estimate, modules, research risks, first milestone. Demands a
   strict JSON shape with the 4/3/2/2 counts and a rule locked to the stack.
2. `runDeepDiveAgent`: Jarvislabs direct → normalize → render.
3. `normalize`: strict — module notes without valid names/notes are dropped,
   arrays clamped (4/3/2/2); an unusable payload falls to the chain.
4. Deterministic fallback: builds module notes from the architecture (identifies
   the pure "core" module vs adapters), template edge/e2e test ideas, de-risks
   from research risks, nextMoves naming the core module + re-scoring.

## Inputs / outputs

- In: full `ctx`.
- Out: `{ moduleNotes[], extraTests[], pitfalls[], nextMoves[], text, mode }` —
  rendered as output card 08 with the mode badge (`Jarvislabs · live` etc.).

## Failure behavior

No keys anywhere → honest `deterministic` mode with useful template content.
It never blocks or 500s the run; a failed card is a visible truth, not a crash.

## Model switching

`JARVISLABS_MODEL` env (default `glm-5.3`): `deepseek-v4-flash` for cheap
long-form, `glm-5.3-flash` for the lowest cost, Gemma variants for A/B
comparisons. Set in `.env`; switch per run to compare quality.
