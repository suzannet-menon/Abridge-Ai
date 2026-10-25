import { fetchGitHub } from '../services/github.js';
import { runGitHubAgent } from '../agents/githubAgent.js';
import { runResearchAgent } from '../agents/researchAgent.js';
import { runFeasibilityAgent } from '../agents/feasibilityAgent.js';
import { runArchitectureAgent } from '../agents/architectureAgent.js';
import { runTechStackAgent } from '../agents/techStackAgent.js';
import { runBuilderAgent } from '../agents/builderAgent.js';
import { runBriefAgent } from '../agents/briefAgent.js';
import { runDeepDiveAgent } from '../agents/deepDiveAgent.js';

/**
 * THE stage registry — single source of truth for the pipeline.
 * Adding, reordering, renaming, or removing a stage means editing THIS file only.
 * The runner (runPipeline.js) is a generic loop; UIs and exports read metadata
 * from here via GET /api/meta.
 */
export const STAGES = {
  github: {
    key: 'github',
    index: 1,
    label: 'Builder Signals',
    nextHint: 'Research & opportunity scan — market signals, risks, and recommended direction.',
    async run(ctx) {
      const gh = await fetchGitHub(ctx.input.github);
      const text = runGitHubAgent(gh);
      const badge = gh.source === 'live' ? 'live · github.com' : 'sample data';
      return { text, badge, source: gh.source, profile: gh.profile, languages: gh.languages, repos: gh.repos };
    },
  },

  research: {
    key: 'research',
    index: 2,
    label: 'Research & Opportunities',
    nextHint: 'Feasibility score — a /100 verdict with effort estimate and risk register.',
    async run(ctx) {
      return runResearchAgent(ctx.input, ctx.results.github);
    },
  },

  feasibility: {
    key: 'feasibility',
    index: 3,
    label: 'Feasibility Assessment',
    nextHint: 'Architecture direction — module breakdown and data-flow blueprint.',
    async run(ctx) {
      return runFeasibilityAgent(ctx.input);
    },
  },

  architecture: {
    key: 'architecture',
    index: 4,
    label: 'Architecture Direction',
    nextHint: 'Tech stack recommendation matched to your comfort level.',
    async run(ctx) {
      return runArchitectureAgent(ctx);
    },
  },

  stack: {
    key: 'stack',
    index: 5,
    label: 'Tech Stack',
    nextHint: 'Builder plan — starter scaffold with file tree and milestone checklist.',
    async run(ctx) {
      return runTechStackAgent(ctx.input);
    },
  },

  builder: {
    key: 'builder',
    index: 6,
    label: 'Builder Plan & Scaffold',
    nextHint: 'Project brief — your complete implementation plan ready to follow.',
    async run(ctx) {
      return runBuilderAgent(ctx);
    },
  },

  brief: {
    key: 'brief',
    index: 7,
    label: 'Project Brief',
    nextHint: 'Deep Dive — module-by-module explanations, extra tests, and pitfalls.',
    async run(ctx) {
      return runBriefAgent(ctx);
    },
  },

  deepdive: {
    key: 'deepdive',
    index: 8,
    label: 'Deep Dive',
    nextHint: 'Planning complete — download the scaffold or export the project brief.',
    async run(ctx) {
      return runDeepDiveAgent(ctx);
    },
  },
};

export const STAGE_ORDER = ['github', 'research', 'feasibility', 'architecture', 'stack', 'builder', 'brief', 'deepdive'];

export function stageMeta() {
  return STAGE_ORDER.map(key => ({
    key,
    index: STAGES[key].index,
    label: STAGES[key].label,
    nextHint: STAGES[key].nextHint,
  }));
}