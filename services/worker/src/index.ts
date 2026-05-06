import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

async function processJob(job: Job) {
  logger.info(`Processing job ${job.id}: ${job.name}`, {
    data: job.data
  });

  switch (job.name) {
    case 'example-task':
      return { processed: true, timestamp: new Date().toISOString() };
    default:
      logger.warn(`Unknown job type: ${job.name}`);
      return { processed: false, reason: 'Unknown job type' };
  }
}

const worker = new Worker('default-queue', processJob, {
  connection: redisConnection,
  concurrency: 5
});

worker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed:`, { error: err.message });
});

worker.on('error', (err) => {
  logger.error('Worker error:', { error: err.message });
});

logger.info('REZ Worker started');

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker...');
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
});
