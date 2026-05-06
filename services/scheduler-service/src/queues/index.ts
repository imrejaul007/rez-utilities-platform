// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
import { Queue } from 'bullmq';
import { redis } from '../config/redis';
import { config, JobName } from '../config/index';
import { logger } from '../config/logger';

const queueMap = new Map<JobName, Queue>();

export function createQueue(jobName: JobName): Queue {
  const existing = queueMap.get(jobName);
  if (existing) return existing;

  const queue = new Queue(jobName, {
    connection: redis,
    defaultJobOptions: {
      attempts: config.jobs[jobName]?.retries || 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600, // Keep for 1 hour
      },
      removeOnFail: false, // SCH-03: keep failed jobs until worker moves them to DLQ
    },
  });

  queueMap.set(jobName, queue);
  logger.debug(`[Queue] Created queue for job: ${jobName}`);

  return queue;
}

export function registerAllQueues(): void {
  Object.keys(config.jobs).forEach((jobName) => {
    createQueue(jobName as JobName);
  });
  logger.info(`[Queue] Registered ${queueMap.size} job queues`);
}

export function getQueue(jobName: JobName): Queue {
  const queue = queueMap.get(jobName);
  if (!queue) {
    throw new Error(`Queue not found for job: ${jobName}`);
  }
  return queue;
}

export function getAllQueues(): Map<JobName, Queue> {
  return queueMap;
}
