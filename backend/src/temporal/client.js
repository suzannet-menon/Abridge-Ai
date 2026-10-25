import { Client, Connection } from '@temporalio/client';
import {
  TEMPORAL_ADDRESS,
  TEMPORAL_API_KEY,
  TEMPORAL_NAMESPACE,
  TEMPORAL_TLS,
} from './config.js';

let clientPromise;

export function getTemporalClient() {
  if (!clientPromise) {
    clientPromise = Connection.connect({
      address: TEMPORAL_ADDRESS,
      connectTimeout: '5 seconds',
      tls: TEMPORAL_TLS,
      apiKey: TEMPORAL_API_KEY,
    })
      .then(connection => new Client({ connection, namespace: TEMPORAL_NAMESPACE }))
      .catch(error => {
        clientPromise = undefined;
        throw error;
      });
  }
  return clientPromise;
}
