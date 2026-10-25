# Agents — the people inside the pipeline

AbridgeAI's pipeline is a chain of **agents**. Each agent has one job, one file,
one kind of output. The stage registry (`backend/src/pipeline/stages.js`) calls
them in order and passes a shared context `{ input, results, errors }`, so every
later agent can read what earlier agents decided.

| # | Agent | File | One-line job |
|---|-------|------|--------------|
| 1 | Builder Signals | `backend/src/agents/githubAgent.js` | Read the builder's public GitHub → comfort signal |
| 2 | Research | `backend/src/agents/researchAgent.js` | Scan the idea for opportunities, risks, a direction |
| 3 | Feasibility | `backend/src/agents/feasibilityAgent.js` | Score the idea /100 with a GO · caution · rethink verdict |
| 4 | Architecture | `backend/src/agents/architectureAgent.js` | Module map + data-flow shape + design principles |
| 5 | Tech Stack | `backend/src/agents/techStackAgent.js` | Pick or parse the stack and explain it |
| 6 | Builder | `backend/src/agents/builderAgent.js` | Milestone plan + generate the starter scaffold (.zip) |
| 7 | Brief | `backend/src/agents/briefAgent.js` | Assemble the canonical project brief |
| 8 | Deep Dive | `backend/src/agents/deepDiveAgent.js` | Jarvislabs-powered handover doc: notes, tests, pitfalls |

Two kinds of agents exist on purpose:

- **Deterministic** (1, 3, 5): pure functions. Same input → same output, no LLM.
- **LLM-capable** (2, 4, 6, 7, 8): try the provider chain
  (Gemini → Groq → Jarvislabs → deterministic fallback), always label the result
  mode so the UI can show `Gemini · live` / `Groq · live` / `fallback`.

For detail, open the matching md in this folder — one per agent, each answering
**what, why, how, and what happens when it fails.**
