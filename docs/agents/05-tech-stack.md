# 05 · Tech Stack — the stack agent

**File:** `backend/src/agents/techStackAgent.js` · **Registry entry:** `stack` (index 5)
**Type: fully deterministic — no LLM at any provider depth.**

## What it does

Renders the stack card: either a bundled stack recommendation (TypeScript,
Python, Go, Rust presets with runtime/UI/API/data/test/lint rows and a "why")
or — for a custom stack — a **component breakdown** parsed from free text
("FastAPI + React + PostgreSQL" → API/UI/Data categories), plus unknowns reported
instead of silently dropped ("odin" → *not yet recognized*).

## Why its position matters

It comes after feasibility's stack-fit axis (comfort) and before the builder.
The builder stage consumes `stack.label` as its hard constraint, and the
scaffold generator reads the **starter language** routed from it
(`starterLanguageFor`: FastAPI/Flask/Django → python starter, gin/echo → go,
axum/actix → rust, else TypeScript). This agent is therefore the bridge between
what the user typed and which starter zip gets generated.

## How it works

- Custom stacks: `parseCustomStack` (`domain/techs.js`) tokenizes with
  `C++`/`C#` protected from splitting, matches against a ~100-entry TECH_MAP,
  and groups by category. Adds a starter-matching note and custom-stack
  guidance (pin versions, check maintenance, minimal integration proof first).
- Comfort tailors the advice: beginner → scaffolding + one feature at a time;
  intermediate → small tests per module; advanced → skip guardrails, CI early.
- "unsure" → shows bundled stack presets with their rationale.

## Inputs / outputs

- In: `ctx.input` (stack, customStack, comfort).
- Out: `{ label, text, custom parsed details }` — `label` feeds the builder prompt
  and README (`stackLabelFor`).

## Failure behavior

Cannot fail: unknown stacks become "unknown components" listings, not errors.
The scaffold note honestly says when no starter matches and which default is used.
