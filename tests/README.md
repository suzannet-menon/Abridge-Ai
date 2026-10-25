# AbridgeAI test suite

Zero-dependency, runs on the Node built-in test runner (Node ≥ 20).
Hermetic by default: **no API keys, no network** — LLM stages degrade to the
bundled deterministic agents and the suite still asserts honest behavior.

```bash
npm test
npm run test:backend   # Temporal test-environment suites (backend/test/)
```

## What "satisfying" means here

Each file pins a contract that must hold after any change:

| File | Contract it locks |
|------|-------------------|
| `unit/hash.test.js` | Determinism: FNV-1a hash + seeded pick are stable, 32-bit, collision-free |
| `unit/deadline.test.js` | Deadline parsing ("2 weeks" → 14d), score bands, day-range milestone slots |
| `unit/techs.test.js` | Custom stacks parse (`C++` survives splitting, unknowns reported), starter routing |
| `unit/scaffold.test.js` | Every zip has PLAN/README/**index.html**/fixture; index.html is complete + **HTML-escaped**; ≥3 runnable tests per stack (TS/Py/Go/Rust) |
| `unit/deepdive-agent.test.js` | Stage 8 always returns module notes + tests + pitfalls + next moves, and labels its mode honestly |
| `unit/llm-chain.test.js` | With no keys, the 3-provider chain refuses (never fakes `ok: true`); cache is stable |
| `unit/jobs.test.js` | Background job completes ALL stages to `done` in a real run, results carry every stage |
| `integration/api.test.js` | Boots the real Express app over HTTP: health, meta (8 stages), workflow start (202 + workflowId) / 503-when-Temporal-down, workflow status, job start+poll, and the **429 rate limit** |

## Rules for the team

1. `npm test` must stay green. Red suite = do NOT merge your change.
2. Breaking a test on purpose? Update the test **in the same commit** and say why
   in the commit message.
3. New feature → new test file in the matching folder. Provenance-honest features
   (Jarvislabs, Temporal) must always be testable **without their keys**.
4. Run lint too before merging: `npm run lint`.
5. Tests never load `.env` (plain `node --test`), so real API keys are never
   billed inside the suite. For a manual live check, use the playground or
   `npm run server` and does the UI end up with the right badges, not tests.

## Working-split acceptance criteria

- **Kepler owner** — no code in this folder; acceptance = challenge post shipped +
  screenshots of an Observe session against `http://localhost:3001/api/health` +
  one scaffold folder checked in Kepler's terminal.
- **Temporal owner** — acceptance = `docker compose up -d` works, Temporal UI shows
  the 8 stages as activities, one retry demonstrated. The **job status shape in
  `unit/jobs.test.js` + `integration/api.test.js` is the contract the Temporal
  worker must reproduce** (status → complete, stages map, stageErrors, results payload).
- **Jarvislabs owner** — acceptance = `.env` has a real key, Stage 8 shows
  `Jarvislabs · live` in a real run, model comparison (GLM vs DeepSeek vs Gemma)
  documented in notes; suite must still pass **without** the key.
Backend tests use Temporal's local test environment; they may download the
Temporal test server on first run. They do not invoke Gemini, Groq, or GitHub.

**Temporal owner note:** the job status shape in `unit/jobs.test.js` +
`integration/api.test.js` is exactly what `backend/src/temporal/workflows.js`
emits (mapped `completed → done`, `failed → error` by the frontend).
