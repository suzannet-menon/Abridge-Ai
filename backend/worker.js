import { fileURLToPath } from 'node:url';
import { NativeConnection, Worker } from '@temporalio/worker';
import { runPlanningStage } from './src/temporal/activities.js';
import {
  TEMPORAL_ADDRESS,
  TEMPORAL_API_KEY,
  TEMPORAL_NAMESPACE,
  TEMPORAL_TASK_QUEUE,
  TEMPORAL_TLS,
} from './src/temporal/config.js';

const workflowsPath = fileURLToPath(new URL('./src/temporal/workflows.js', import.meta.url));
const connection = await NativeConnection.connect({
  address: TEMPORAL_ADDRESS,
  connectTimeout: '5 seconds',
  tls: TEMPORAL_TLS,
  apiKey: TEMPORAL_API_KEY,
});

try {
  const worker = await Worker.create({
    connection,
    namespace: TEMPORAL_NAMESPACE,
    taskQueue: TEMPORAL_TASK_QUEUE,
    workflowsPath,
    activities: { runPlanningStage },
  });
  console.log(`[worker] connected to ${TEMPORAL_ADDRESS}, namespace "${TEMPORAL_NAMESPACE}", queue "${TEMPORAL_TASK_QUEUE}"`);
  await worker.run();
} finally {
  await connection.close();
}
