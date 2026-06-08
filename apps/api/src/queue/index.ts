import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { GitHubWebhookJob } from '@devpulse/types';
import { loadEnv } from '../config/env';

const env = loadEnv();

export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// BullMQ bundles its own ioredis — cast to avoid duplicate-type conflicts
const bullConnection = redisConnection as unknown as import('bullmq').ConnectionOptions;

export const githubEventsQueue = new Queue<GitHubWebhookJob>('github-events', {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redisConnection.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

export { bullConnection };
