# 01 · Builder Signals — the GitHub agent

**File:** `backend/src/agents/githubAgent.js` · **Registry entry:** `github` (index 1)
**Type: deterministic — no LLM, no text generation of its own.**

## What it does

Takes the GitHub username from the form and turns public profile data into a
"builder signal": who this person is, what languages they actually use, and what
they'd likely be comfortable building with. It renders this as the first output
card (Builder Signals).

## Why it exists first in the chain

Feasibility and architecture make recommendations ("prefer Python tooling",
"sleep on the CI setup"). Those recommendations would be generic without knowing
who is building. This agent runs first so every later stage — especially the
LLM prompts (research/architecture/builder) — can weigh the builder's real
language history instead of guessing. Its output is what stops the pipeline
from suggesting Node.js to someone who has never shipped JavaScript.

## How it works

1. `services/github.js` fetches `api.github.com/users/<name>` + `repos?per_page=100`
   (unauthenticated, 10s timeout, no keys needed).
2. Fallback ladder: **live → repo sample file (`public/data/sample-github-analysis.json`)
   → embedded octocat sample** (so the app always renders, even offline).
3. The agent **only formats** — it tallies languages, sorts repos by stars,
   derives "comfortable with" (top 3 by repo count) vs "less represented", and
   prints a one-line recommendation: *prefer familiar languages for the first version*.

## Inputs / outputs

- In: `ctx.input.github` (username, optional).
- Out: `{ text, badge ('live · github.com' | 'sample data'), source, profile, languages, repos }`
  — `languages` is later reused in the research prompt.

## Failure behavior

Never throws: a bad username, 404, or a network failure silently degrades to
sample data and the badge flips to `sample data`. Check the badge when judging
a demo run — a sample badge means signals are decorative, not personal.
