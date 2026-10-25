# 03 · Feasibility — the scoring agent

**File:** `backend/src/agents/feasibilityAgent.js` · **Registry entry:** `feasibility` (index 3)
**Type: fully deterministic — pure scoring math, never calls an LLM.**

## What it does

Answers the user's actual question: *should I build this?* It computes a
weighted **/100 score** across 5 axes and a verdict:

| Axis | Max | Driven by |
|------|-----|-----------|
| Idea clarity | 30 | word count of the idea + audience presence |
| Stack fit | 25 | comfort level (advanced 25 / intermediate 20 / beginner 15) |
| Scope realism | 20 | project type (tool 20 … web-app 14, unsure 10) |
| Time realism | 15 | parsed deadline (`deadlineScore`: ≤7d → 6 … >90d → 13) |
| Builder fit | 10 | did they pin a stack (10) or "unsure" (6) |

Verdict bands: **≥70 GO** · **50–69 Proceed with caution** · **<50 Rethink/reshape**,
plus an effort estimate (Lean 1–2 wks / Medium 3–5 / Large 6–10, deadline-aware),
a seeded risk register, and a per-verdict recommendation (with a special
tight-deadline line for windows ≤7 days).

## Why it sits between research and architecture

It's the gate. The research stage says "here's the opening"; the score decides
whether the rest of the pipeline plans a build day or recommends reshaping.
The builder stage reuses `feasibility.estimate` and the verdict tone, and the
deadline axes decide whether milestones read "Day 1–2" or "Week 2".

## How it works

Pure math + `parseDeadline` from `domain/deadline.js`. No network, no provider
calls — it renders text and structured results in one pass. Risk register uses
the seeded `pick` over 10 risk/fix pairs, so identical inputs are byte-identical.

## Inputs / outputs

- In: full form input (idea, comfort, type, deadline, stack, customStack, team, audience).
- Out: `{ score, verdict, verdictClass('good'|'warn'|'bad'), verdictMsg, recommendation,
  estimate, axes[5], risks, text }` — the frontend arc + axis bars read `axes` directly.

## Failure behavior

Effectively cannot fail: guards every input with defaults (beginner, unsure,
empty deadline → 8 points). If the idea is empty the score collapses honestly
rather than crashing.
