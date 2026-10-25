# Submission Checklist: the 3-hour plan (system-design grounded)

**Current state:** Gemini integration is wired (`gemini-3.6-flash`, a valid GA
model) with a **Groq fallback** (`GROQ_API_KEY`, OpenAI-compatible) and
deterministic fallbacks behind both. The daily free-tier quota (~20
Gemini requests/day) is the main way the app shows `fallback` badges, so add a
Groq key to ride through it. Everything else is polish.

---

## Phase 1. Critical fix and verification (0-60 min)

| [ ] | Action | System design principle | Why | ~min |
|-----|--------|--------------------------|-----|------|
| [ ] | **Fix model in `backend/.env`** (or root `.env`): `GEMINI_MODEL=gemini-3.6-flash` (or delete the line entirely to use the code default). | Configuration management | Without this the demo will show "Gemini · live" badges but fallback content | 2 |
| [ ] | **Restart the backend** (`npm run server` from root) | Observability | Fresh process reads the updated `.env` at module load (`gemini.js:5`) | 1 |
| [ ] | **Health check:** `curl http://localhost:3001/api/health` → `{"ok":true}` | Graceful degradation | Confirms Express is up before anything else | 1 |
| [ ] | **POST /api/plan** (curl or UI) and confirm `mode = "llm"` for research/architecture/builder/brief | LLM-first / cache-aside pattern | Proves key is sent, model resolves, JSON parses | 5 |
| [ ] | **POST /api/plan identical body again** → confirm `mode = "cached-llm"` | In-process caching | Avoids re-billing; deterministic within session | 1 |
| [ ] | **Verify idea-specific text:** research mentions your idea (not "Small, focused tools…"), architecture modules are idea-specific | Idea-specific LLM output | Validates prompt engineering actually works | 3 |
| [ ] | **POST /api/export** with saved record → markdown contains tailored sections + Gemini footer | Structural integrity (brief model is single-source) | Export must match cards | 2 |
| [ ] | **Review server stderr**, confirm no `[gemini]` error lines | Observability (logging) | Only "no key" → silent is OK; any 4xx/5xx = model/key problem | 2 |
| [ ] | **Run `npm run lint`** (oxlint) | Code hygiene / CI-readiness | Zero-warning before any commit | 1 |
| [ ] | **Git check:** run `git status` and confirm `.env` is NOT listed (gitignored) | Security (secret leak prevention) | `.gitignore:27` excludes `.env` | 1 |
| | | | **Phase 1 total** | **~19 min** |

---

## Phase 2. Polish and verify everything end-to-end (60-120 min)

| [ ] | Action | Principle | Why | ~min |
|-----|--------|-----------|-----|------|
| [ ] | **Build the frontend:** `npm run build` | Stale build guard | `dist/` is old, so new badges/patch notes won't show until rebuilt | 2 |
| [ ] | **Start production mode:** `npm run start` → open `http://localhost:3001` | Single-port deployment | Submissions often just ship one URL | 1 |
| [ ] | **Full UI walkthrough:** run a plan, confirm Research/Arch/Builder/Brief badges show "Gemini · live", download scaffold, export .md, check badge on Brief card | UI contract (App.jsx + BriefCard.jsx) | Regression: brief badge + builder badge added recently | 8 |
| [ ] | **Test with a second idea** (completely different) → visibly different research/architecture/builder/brief | Input sensitivity (no cache collision) | Proves LLM is idea-driven, not just cached for one input | 3 |
| [ ] | **Negative test: garbage model name** → change model to `xyz` briefly, POST plan → all four modes = `deterministic`, app returns complete plan (no 500) | Graceful degradation | Proves fallback path still works (safety net) | 3 |
| [ ] | **Negative test: no key** → remove key temporarily, restart, POST → deterministic, badges "fallback" | Fail-safe / graceful fallback | Critical to demo: "app always works" | 3 |
| [ ] | **Reset back** to working model + key, restart, confirm "llm" again | Restore known-good state | Don't leave the app broken | 1 |
| [ ] | **Verify history loads** an older saved project without re-running the pipeline | Client-side state | localStorage reads should not trigger API calls | 2 |
| [ ] | **Edge case: minimal input** (idea only, blanks for everything) → all 7 stages return, no 500 | Input validation / robustness | A live demo may skip fields | 2 |
| [ ] | **Edge case: long input** (~100 words in idea field) → still completes within ~15s | Performance / API latency | Gemini + 4 sequential calls adds up | 2 |
| [ ] | **Check `node` logs** for any unhandled promise rejection / crash | Observability | Process must stay alive | 1 |
| | | | **Phase 2 total** | **~28 min** |

---

## Phase 3. Documentation, commit, and demo prep (120-180 min)

| [ ] | Action | Principle | Why | ~min |
|-----|--------|-----------|-----|------|
| [ ] | **README quick-start** is accurate: backend serves on one port in prod | Single-port deployment | Judges/reviewer runs one command | 2 |
| [ ] | **Write a short demo script** (or add it to README): the exact commands to reproduce the plan and export | Reproducibility | Submission artifact reviewers will use | 5 |
| [ ] | **Verify `.env.example`** contains valid model (`gemini-2.5-flash` or `gemini-3.6-flash`) | Configuration management | Someone cloning the repo should get a working setup | 1 |
| [ ] | **Clean commit:** stage only intentional files (check `git status`), write clear message, never commit `.env` | Security / clean history | Don't leak the key; message follows conventional format | 3 |
| [ ] | **`git diff --staged` review**: no secrets, no unrelated churn | Secret leak audit | One last pass | 2 |
| [ ] | **Tag or note the submission commit hash** | Traceability | Needed if submission platform asks for a SHA | 1 |
| | | | **Phase 3 total** | **~14 min** |

---

## What NOT to do (risk = low value + high disruption)

| [ ] | Don't | Why it's risky right now | System design principle |
|-----|-------|--------------------------|-------------------------|
| [ ] | Don't add a new stage / new npm dependency | Breaks the stage registry contract, needs UI + testing | SRP / dependency hygiene |
| [ ] | Don't refactor `stages.js` stage registry or `context.js` | No functional gain, high regression risk | Open-closed principle |
| [ ] | Don't add persistent storage / database / auth | Entirely new feature scope; sessions are ephemeral, fine for demo | YAGNI |
| [ ] | Don't change Express middleware (rate-limit, CORS, helmet) | Unnecessary new config; local-only submission = no network attack surface | Threat model proportional to deployment |
| [ ] | Don't run a formatter across all files (prettier) | Will touch every file, pollute `git diff`, obscure the actual changes | Clean git history |
| [ ] | Don't add "nice-to-have" screenshots/video into source | Useless risk, bloats repo | Ship the app, not the file |
| [ ] | Don't chase `responseMimeType: 'application/json'` for all stages | It already works for Gemini 2.5+; changing to structured outputs API is a separate feature | Stability > perfection |
| [ ] | Don't rewrite the deterministic fallback pools (expand them) | That's a v2 task; current pools demonstrate the concept clearly | Iterative delivery |
| [ ] | Don't set up CI/CD | No GitHub Actions workflow in repo; time is better spent verifying the app | Right tool for the deadline |
| [ ] | Don't try to cache across process restarts (Redis/disk) | Adds infra complexity; in-process Map is perfect for a demo | Right caching layer for the scope |

---

## 15-minute demo runbook (memorize this)

```
1.  npm run build                         # ~10s, ensures dist/ is fresh
2.  npm run start                         # one port: http://localhost:3001
3.  Open http://localhost:3001
4.  (optional) confirm /api/health → {"ok":true}
5.  Fill form → Run → wait ~10-15s (4 Gemini calls) → 7 cards appear
6.  Point at Research badge → "Gemini · live"
7.  Point at Architecture badge → "Gemini · live"
8.  Click "Download scaffold (.zip)" → unzip → show real project files
9.  Click "Export" → open .md → show idea-specific research + architecture sections
10. Re-run identical idea → badge flips to "Gemini · cached"
```

**If Gemini fails mid-demo (network, rate-limit, model error):**
Fallback is built in. Badges show "fallback", all 7 cards still render.
Say: *"The deterministic fallback proves the pipeline never fails."*
That is a feature, not a bug. The demo is resilient by design.

---

## Stretch goals (only if Phases 1-3 done early)

| [ ] | Goal | Time | Impact |
|-----|------|------|--------|
| [ ] | Add a third test idea in the demo (shows variety) | 5 min | Stronger demo |
| [ ] | Screenshot the badges for a README `.png` | 5 min | Visual proof |
| [ ] | Add a `SCRIPT.md` with the demo commands | 3 min | Easy for reviewer |
| [ ] | Record a 2-minute terminal GIF of the export working | 10 min | High-impact demo artifact |

---

## Final `git status` sanity (last 2 minutes)

```powershell
git status --short        # should show only intentional changes
git diff --stat           # confirm no huge unexpected diffs
git diff --staged -- '*.env*'   # must be empty (no .env staged)
```

---

## System design fundamentals → what this submission actually demonstrates

| Fundamental | How it shows up in AbridgeAI |
|-------------|------------------------------|
| **Separation of concerns** | Backend = all logic; frontend = pure render; they talk over HTTP |
| **Single source of truth** | `stages.js` is the only place stages are defined; frontend reads it via `/api/meta` |
| **Graceful degradation** | No key / API error → deterministic fallback; app never 500s |
| **Configuration management** | Secrets in `.env` (gitignored), loaded via `--env-file-if-exists`, code defaults as backup |
| **Cache-aside pattern** | `gemini.js` in-process Map keyed by input hash; never re-bills identical inputs |
| **Structured input/output contract** | Every stage returns a typed object (not raw text); UI consumes fields; `brief/model.js` reads structurally, not by text slicing |
| **Observability** | `[gemini]` / `[groq]` log lines, `mode` badges in UI, `errors` object in pipeline response |
| **Resilience** | Stage failure is captured in `ctx.errors[key]`, pipeline continues; worst case = full fallback |
| **Layered architecture** | Domain logic → agents → service layer (Gemini → Groq) → transport (Express) → React |
| **YAGNI / proportional scope** | Local-only, no auth, no DB, no CDN; matches the actual deployment model |
| **Defensive programming** | `clampArr`, `clampList`, `normalizeMilestones`: LLM output is always sanitized before consumption |
| **Key management** | `encodeURIComponent(API_KEY)` prevents URL injection; key never leaves server; `.gitignore` prevents accidental commit |

---

## Submission copy (copy-paste ready)

### Elevator pitch

> **AbridgeAI turns a rough idea into a build-ready plan in one run.** Describe
> your project in plain English and a seven-stage pipeline scores its
> feasibility, scans market signals, designs an architecture, recommends a
> stack, and generates a real starter scaffold with a README and a milestone
> plan, all in seconds. It works with no API key at all because every AI stage
> has a deterministic fallback and a second LLM provider to catch quota limits.

### About the project

### Inspiration

Every side project starts the same way: a half-formed idea, a blank README,
and a weekend you'll never get back. Good ideas die at the "now what?" step,
before a single file is created. AbridgeAI came from wanting a tool that does
the thinking a project needs before the coding starts. Give it one sentence
and it hands you a feasibility verdict, an architecture, a stack, a real
starter scaffold, and a week-by-week plan, instead of a blank screen.

### What it does

AbridgeAI runs a **seven-stage deterministic planning pipeline** on your local
backend:

1. **Builder Signals** reads your public GitHub profile for signal (optional)
2. **Research & Opportunities** scans the market, flags risks, suggests direction
3. **Feasibility Assessment** scores your idea out of 100 across five weighted axes
4. **Architecture Direction** maps module breakdown and data flow
5. **Tech Stack** recommends a comfort-matched stack, or accepts your own custom combo
6. **Builder Plan & Scaffold** produces a downloadable starter repo (.zip) with a project-specific README.md and PLAN.md
7. **Project Brief** assembles the full brief, viewable in-app or exported as Markdown

Feasibility is scored as

$$\text{score} = \min\left(100,\ c + s + p + t + b\right)$$

across five axes: idea clarity, stack fit, scope, time realism, and builder
fit. Above 70 it says **GO**, between 50 and 70 it says **Proceed with
caution**, and below that **Rethink / reshape**. The plan is honest before
you commit.

Add a **custom stack** like `FastAPI + React + PostgreSQL + Docker` and the
text gets parsed into structured components, the scaffold auto-selects for the
backend language, and the README renders each layer. Type `C++ + Rust` together
and both get recognized. The pipeline lists both and picks the best matching
starter base.

### How we built it

The backend is **Express + Node**, the frontend is **React + Vite**, and all
planning logic lives server-side behind a typed stage registry (`stages.js`).
The UI never rebuilds project logic; it just consumes structured results over
HTTP. Four stages are **LLM-powered**: Gemini goes first, and if it's missing,
out of quota, or unparseable, **Groq** is tried automatically. If both fail, a
deterministic engine takes over so the app never 500s. Badges in the UI tell
you which path ran (`Gemini · live`, `Groq · live`, `LLM · cached`, or
`fallback`).

Even the deterministic fallback is idea-aware. Items are picked by
hash-scored seeding, where every candidate scores as

$$s_i = H(\text{seed} + \text{poolItem}_i)$$

with the best-seeded options chosen. Two similar ideas still diverge and a run
never re-bills the same prompt twice because results are cached per input
hash.

### Challenges we ran into

The biggest challenge was **billing discipline**. The Gemini free tier allows
roughly 20 requests/day on this model, and one run already uses four. A
deployment that worked yesterday shows `fallback` today for no code reason.
Debugging that led to the whole resilience story: a real provider chain
(Gemini, then Groq, then deterministic) instead of a single point of failure.
We also had to keep LLM output honest. Models return malformed JSON, miss keys,
or invent content, so every stage sanitizes and clamps LLM results before
anything touches the UI.

### Accomplishments that we're proud of

- The pipeline **always produces a complete plan**, demo-proof even with no API keys
- A **real downloadable scaffold**, not just text: README.md, PLAN.md, a test, a fixture, and a core module that embeds the project's planned architecture
- Deterministic fallbacks are **idea-specific**, not generic canned text

### What we learned

- Resilient beats ambitious: a fallback chain beats a single "perfect" model
- LLM output is a contract to validate, not a source of truth
- A typed stage registry made adding stages trivial, single source of truth
- Caching identical inputs prevents cost spikes and guarantees stable re-runs

### What's next for AbridgeAI

- More starter languages (C++/C#, web frameworks) and richer scaffolds
- A persisted project store plus cloud run for multi-user use
- Cost-tiered provider routing (which stage uses which provider, by cost)

### Tags

react, nodejs, Express, TypeScript, Vite, gemini-ai, groq-cloud,
llm, ai, hackathon, web-app, project-planning, scaffolding,
developer-tools