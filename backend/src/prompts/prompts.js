/**
 * Prompt builders for the LLM-capable stages (research, architecture,
 * builder, brief). These are the contract between the app and the model:
 * the strict JSON shapes here are exactly what the stage agents consume, and
 * every prompt tells the model to be concrete and idea-specific so output is
 * never generic. A no-key API failure always falls back to the bundled agents.
 */

function jsonShape(name, example) {
  return `Return ONLY strict JSON matching this shape (no markdown fences, no commentary, no extra keys):\n${JSON.stringify(example, null, 2)}`;
}

/** Research stage prompt: market signal scan for THIS idea. */
export function buildResearchPrompt(input, gh) {
  const languages = gh?.languages?.length
    ? gh.languages.slice(0, 5).map(l => `${l.language} (${l.count} repos)`).join(', ')
    : 'no public repo data (sample fallback)';
  const stack = input.customStack || (input.stack && input.stack !== 'unsure' ? input.stack : 'undecided');

  return `You are a research analyst inside a project-planning studio. A developer submitted a project idea. Produce a short, concrete, independent research brief for THIS idea.

Project idea: "${input.idea}"
Project type: ${input.type || 'not specified'}
Target audience: ${input.audience || 'not specified'}
Deadline: ${input.deadline || 'not specified'}
Builder comfort level: ${input.comfort || 'not specified'}
Chosen stack: ${stack}
Builder's top GitHub languages: ${languages}

${jsonShape('research brief', {
    opportunities: ['...', '...', '...'],
    risks: ['...', '...', '...'],
    directions: ['...', '...'],
    builderSignal: '...',
  })}

Rules:
- Exactly 3 opportunities, 3 risks, 2 directions, 1 builderSignal.
- Every item MUST reference this specific idea, its type, audience, or deadline. One sentence, max 24 words, no leading numbering.
- Forbidden filler phrases: "build a vertical slice", "scope carefully", "iterate quickly", "define an MVP" — say something specific instead.
- Be realistic. Never invent market data, competitors, or facts about the user.
- builderSignal: one sentence tying the builder's language history (or its absence) to the idea.
- STACK IS A HARD CONSTRAINT: every recommendation and direction MUST assume the chosen stack (${stack}) and its languages. Never suggest switching language families (e.g. no Node.js/JavaScript advice for a Python/C++ idea) — instead name libraries, packaging, or tooling for ${stack}. If the stack is undecided, only then may you weigh the builder's GitHub languages.`;
}

/** Architecture stage prompt: module + data-flow blueprint for THIS idea. */
export function buildArchitecturePrompt(input, ctx) {
  const research = ctx?.results?.research || {};
  return `You are a software architect inside a project-planning studio. Design a concrete module and data-flow blueprint for THIS idea only.

Project idea: "${input.idea}"
Project type: ${input.type || 'not specified'}
Target audience: ${input.audience || 'not specified'}
Deadline: ${input.deadline || 'not specified'}
Builder comfort level: ${input.comfort || 'not specified'}
Research direction already found: ${research.directions?.[0] || 'not researched yet'}

${jsonShape('architecture blueprint', {
    shape: 'one-line architecture shape, e.g. "ingest -> normalize -> generate -> deliver"',
    modules: ['module name', 'module name', 'module name', 'module name'],
    flow: 'one-line description of how data moves through the modules',
    principles: ['design principle', 'design principle', 'design principle'],
  })}

Rules:
- Exactly 4 modules, 1 flow, 3 principles, 1 shape.
- Module names and the flow MUST be derived from the specific idea (e.g. "inventory adapter", "post renderer"), never the generic pool list like "core / domain logic".
- Each principle one sentence, max 20 words, tied to this idea's risks.
- One module is the pure, deterministic "core" that holds all business logic; the rest are thin adapters around it.
- shape is one short line (max 8 tokens, arrows optional).`;
}

/** Builder stage prompt: tailored milestone plan + overview (scaffold stays bundled). */
export function buildBuilderPrompt(input, ctx) {
  const stack = ctx?.results?.stack || {};
  const arch = ctx?.results?.architecture || {};
  const feas = ctx?.results?.feasibility || {};
  const research = ctx?.results?.research || {};
  const modules = (arch.modules || []).join(', ') || 'not decided yet';
  const stackLabel = stack.label || input.customStack || 'not decided yet';
  const deadlineDays = ctx?.deadlineDays;
  const unitHint = deadlineDays != null && deadlineDays <= 14
    ? `The deadline is only ${deadlineDays} day(s) — size the milestones as DAY ranges that fit the window (e.g. "Day 1", "Day 1-2"), never weeks.`
    : `The deadline is ${input.deadline || 'not specified'} — size the milestones to fit it.`;
  return `You are an implementation coach inside a project-planning studio. Write a build plan for THIS idea, mapped onto the architecture that was already designed and sized to the deadline.

Project idea: "${input.idea}"
Project type: ${input.type || 'not specified'}
Deadline: ${input.deadline || 'not specified'}
Builder comfort level: ${input.comfort || 'not specified'}
Chosen stack: ${stackLabel}
Feasibility: ${feas ? `${feas.score}/100 — ${feas.verdict}` : '—'}
Architecture shape: ${arch.shape || 'not decided yet'}
Architecture modules: ${modules || 'not decided yet'}
Research direction: ${research.directions?.[0] || 'not researched yet'}

${jsonShape('build plan', {
    overview: '2-3 sentence build overview tied directly to the idea',
    milestones: [
      { week: 1, title: 'Short title', tasks: ['task', 'task'], accept: 'concrete done-when condition' },
      { week: 2, title: 'Short title', tasks: ['task', 'task', 'task'], accept: 'concrete done-when condition' },
      { week: 3, title: 'Short title', tasks: ['task', 'task', 'task'], accept: 'concrete done-when condition' },
      { week: 4, title: 'Short title', tasks: ['task', 'task'], accept: 'concrete done-when condition' },
    ],
  })}

Rules:
- Exactly 4 milestones numbered 1-4 in order (integers only).
- ${unitHint}
- Title is a short project-specific name (e.g. "Rule Engine", "Intake & Matching") — never the generic "Foundation / Core slice / Harden / Ship".
- Tasks and done-when conditions MUST reference THIS idea's inputs, outputs, and the architecture module names above. Every milestone must name at least one of: ${modules || 'a module from the architecture'}.
- 2-4 tasks per milestone, each one actionable sentence referencing a deliverable (max 14 words).
- STACK IS A HARD CONSTRAINT: every task and tool MUST respect the chosen stack (${stackLabel}) and its languages. Never propose a different language family (no Node.js/commander.js steps for a Python/C++ idea).
- overview mentions the idea's core value, the first slice to ship, and stays realistic for the deadline.`;
}

/** Brief stage prompt: tailors the written brief sections (context stays structured). */
export function buildBriefPrompt(ctx) {
  const input = ctx?.input || {};
  const r = ctx?.results || {};
  const stackLabel = r.stack?.label || input.customStack || '—';
  return `You are a project-brief writer. Given a finished analysis, write the narrative sections of an implementation plan for THIS project.

Project idea: "${input.idea}"
Owner: ${input.name || 'the builder'}
Audience: ${input.audience || 'not specified'}
Deadline: ${input.deadline || 'not specified'}
Feasibility: ${r.feasibility ? `${r.feasibility.score}/100 — ${r.feasibility.verdict}` : '—'}
Stack: ${stackLabel}
Architecture: ${r.architecture?.shape || '—'}
Research signal: ${r.research?.directions?.[0] || '—'}
Research opportunities: ${(r.research?.opportunities || []).join(' | ') || '—'}
Planned milestones: ${(r.builder?.milestones || []).map(m => `${m.slot || `Week ${m.week}`} ${m.title}`).join(', ') || '—'}

${jsonShape('brief sections', {
    story: 'one paragraph (4-6 sentences) tying the idea, feasibility verdict, and research signal together',
    nextSteps: ['...', '...', '...', '...'],
    mvpGuidance: ['...', '...'],
  })}

Rules:
- story is 4-6 sentences, idea-specific, matching the verdict tone (GO / caution / rethink).
- Exactly 4 next steps, each one concrete sentence (max 16 words) ordered from first action onward.
- Exactly 2 mvp-scope rules that reference THIS idea's core deliverable.
- STACK IS A HARD CONSTRAINT: every next step MUST use the chosen stack (${stackLabel}) and its languages — no Node.js / JavaScript tooling for a Python-or-C++ stack, and no switching the language family mid-plan.
- Fit the timeline: the deadline is ${input.deadline || 'not specified'}; steps should fit that window, not assume unlimited time.
- Never mention "this plan was generated deterministically".`;
}

/** Deep-dive stage prompt: explains every module and proposes extra tests for THIS project. */
export function buildDeepDivePrompt(ctx) {
  const input = ctx?.input || {};
  const r = ctx?.results || {};
  const stackLabel = r.stack?.label || input.customStack || '—';
  const modules = (r.architecture?.modules || []).join(', ') || 'entry, core, output';
  return `You are a senior engineer writing a handover doc for a project that was just planned. Read the analysis below and go one level deeper for THIS project only.

Project idea: "${input.idea}"
Type: ${input.type || '—'} · Audience: ${input.audience || '—'} · Deadline: ${input.deadline || '—'}
Stack: ${stackLabel}
Feasibility: ${r.feasibility ? `${r.feasibility.score}/100 — ${r.feasibility.verdict}` : '—'} ${r.feasibility?.estimate ? `(est. ${r.feasibility.estimate})` : ''}
Architecture shape: ${r.architecture?.shape || '—'}
Architecture modules: ${modules}
Research risks: ${(r.research?.risks || []).join(' | ') || '—'}
First milestone: ${(r.builder?.milestones || []).map(m => `${m.slot || `Week ${m.week}`} — ${m.title}`).join(', ') || '—'}

${jsonShape('deep dive', {
    moduleNotes: [
      { name: 'one module name from the list above', note: '2-3 sentences: what it does, the tricky part, and how the stack tooling helps.' },
      { name: 'another module name', note: '...' },
      { name: 'another module name', note: '...' },
      { name: 'another module name', note: '...' },
    ],
    extraTests: ['one concrete unit or end-to-end test worth adding', 'one more', 'one more'],
    pitfalls: ['the most likely mistake for THIS idea, given its risks', 'one more'],
    nextMoves: ['the single next action after milestone 1', 'one more'],
  })}

Rules:
- moduleNotes cover ${modules.length >= 4 ? '4' : 'ALL'} modules from the list ("${modules}"), one entry each; a note MUST mention how to implement it with ${stackLabel}.
- extraTests are specific and runnable in the chosen stack (name the fixture or function to assert, max 22 words).
- pitfalls tie to the research risks above, not generic advice.
- nextMoves are order-safe first steps (max 18 words each) using ${stackLabel} tooling.`;
}