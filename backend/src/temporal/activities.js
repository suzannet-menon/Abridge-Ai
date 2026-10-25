import { createContext } from '../pipeline/context.js';
import { STAGES, STAGE_ORDER } from '../pipeline/stages.js';

export async function runPlanningStage({ key, input, results }) {
  const stage = STAGES[key];
  if (!STAGE_ORDER.includes(key) || !stage) {
    throw new Error(`Unknown planning stage "${key}"`);
  }

  const ctx = createContext(input);
  ctx.results = results;
  return stage.run(ctx);
}
