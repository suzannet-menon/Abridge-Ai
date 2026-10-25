import {
  defineQuery,
  proxyActivities,
  setHandler,
} from '@temporalio/workflow';
import { PLAN_PROGRESS_QUERY } from './workflowConstants.js';

const STAGE_ORDER = ['github', 'research', 'feasibility', 'architecture', 'stack', 'builder', 'brief', 'deepdive'];

function failureMessage(error) {
  let cause = error;
  for (let depth = 0; depth < 5 && cause?.cause; depth += 1) {
    cause = cause.cause;
  }
  return cause instanceof Error ? cause.message : String(cause);
}

const { runPlanningStage } = proxyActivities({
  startToCloseTimeout: '3 minutes',
  scheduleToCloseTimeout: '7 minutes',
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '5 seconds',
    maximumAttempts: 2,
  },
});

export const planProgressQuery = defineQuery(PLAN_PROGRESS_QUERY);

export async function planWorkflow(input) {
  const progress = {
    status: 'running',
    stages: Object.fromEntries(STAGE_ORDER.map(key => [key, 'queued'])),
    results: {},
    errors: {},
  };
  setHandler(planProgressQuery, () => progress);

  for (const key of STAGE_ORDER) {
    progress.stages[key] = 'running';
    try {
      progress.results[key] = await runPlanningStage({
        key,
        input,
        results: progress.results,
      });
      progress.stages[key] = 'completed';
    } catch (error) {
      progress.stages[key] = 'failed';
      progress.errors[key] = failureMessage(error);
    }
  }

  progress.status = 'completed';
  return {
    status: progress.status,
    stages: progress.stages,
    results: progress.results,
    errors: progress.errors,
  };
}
