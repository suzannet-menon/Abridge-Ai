export const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
export const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'default';
export const TEMPORAL_TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || 'abridgeai-planning';
export const TEMPORAL_TLS = process.env.TEMPORAL_TLS === 'true';
export const TEMPORAL_API_KEY = process.env.TEMPORAL_API_KEY || undefined;

if (TEMPORAL_API_KEY && !TEMPORAL_TLS) {
  throw new Error('Set TEMPORAL_TLS=true when using TEMPORAL_API_KEY.');
}
