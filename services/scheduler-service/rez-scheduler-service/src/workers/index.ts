// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
import { Worker, Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../config/redis';
import { config, JobName } from '../config/index';
import { logger } from '../config/logger';
import { ScheduleConfig } from '../models/ScheduleConfig';

// Import processors
import { settlementReconciliation, payoutProcessing, invoiceGeneration } from '../processors/settlementProcessor';
import { creditScoreRefresh, loyaltyPointsExpiry, campaignExpiry, abandonedCartReminder } from '../processors/userEngagementProcessor';
import { expiredOtpCleanup, sessionCleanup, tempFileCleanup, auditLogArchival } from '../processors/cleanupProcessor';
import { merchantAnalyticsRollup, subscriptionRenewalCheck, mandateStatusSync } from '../processors/merchantProcessor';
import { digestEmail, pushNotificationBatch, coinExpiryAlerts } from '../processors/notificationProcessor';

/** Maps each job name to its processor function */
const processorMap: Record<string, (job: Job) => Promise<void>> = {
  'settlement-reconciliation': settlementReconciliation,
  'payout-processing': payoutProcessing,
  'invoice-generation': invoiceGeneration,
  'credit-score-refresh': creditScoreRefresh,
  'loyalty-points-expiry': loyaltyPointsExpiry,
  'campaign-expiry': campaignExpiry,
  'abandoned-cart-reminder': abandonedCartReminder,
  'expired-otp-cleanup': expiredOtpCleanup,
  'session-cleanup': sessionCleanup,
  'temp-file-cleanup': tempFileCleanup,
  'audit-log-archival': auditLogArchival,
  'merchant-analytics-rollup': merchantAnalyticsRollup,
  'subscription-renewal-check': subscriptionRenewalCheck,
  'mandate-status-sync': mandateStatusSync,
  'digest-email': digestEmail,
  'push-notification-batch': pushNotificationBatch,
  'coin-expiry-alerts': coinExpiryAlerts,
};

const workers: Worker[] = [];

/**
 * Register all BullMQ workers for scheduled jobs.
 * Each worker listens on its own queue and calls the matching processor.
 */
export function registerAllWorkers(): void {
  const jobNames = Object.keys(config.jobs) as JobName[];

  for (const jobName of jobNames) {
    const processor = processorMap[jobName];
    if (!processor) {
      logger.warn(`[Workers] No processor found for job: ${jobName} — skipping`);
      continue;
    }

    // SCH-08: defaultJobOptions with removeOnComplete/removeOnFail
    const worker = new Worker(
      jobName,
      async (job: Job) => {
        logger.info(`[Workers] Processing job: ${jobName}`, { jobId: job.id });
        await processor(job);
      },
      {
        connection: redis,
        concurrency: 1,
        limiter: {
          max: 1,
          duration: 5000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { age: 24 * 3600 },
      },
    );

    worker.on('completed', (job) => {
      logger.info(`[Workers] Job completed: ${jobName}`, { jobId: job?.id });
    });

    worker.on('failed', (job, err) => {
      logger.error(`[Workers] Job failed: ${jobName}`, {
        jobId: job?.id,
        error: err.message,
      });
    });

    worker.on('error', (err) => {
      logger.error(`[Workers] Worker error: ${jobName}`, { error: err.message });
    });

    workers.push(worker);
    logger.debug(`[Workers] Registered worker for: ${jobName}`);
  }

  logger.info(`[Workers] Registered ${workers.length} workers`);
}

/**
 * Schedule repeatable (cron) jobs for all enabled configs.
 * Checks ScheduleConfig in DB — if a job is disabled or has a cronOverride, those are used.
 *
 * SCH-10: Job data now includes a unique runId (UUID) for tracing and deduplication.
 */
export async function scheduleAllCronJobs(): Promise<void> {
  const { createQueue } = await import('../queues/index');
  const jobNames = Object.keys(config.jobs) as JobName[];

  for (const jobName of jobNames) {
    const jobConfig = config.jobs[jobName];
    if (!jobConfig) continue;

    // Check runtime config
    const scheduleConfig = await ScheduleConfig.findOne({ jobName });
    const enabled = scheduleConfig?.enabled ?? true;
    const cron = scheduleConfig?.cronOverride || jobConfig.cron;

    if (!enabled) {
      logger.info(`[Workers] Job disabled via config: ${jobName}`);
      continue;
    }

    const queue = createQueue(jobName);
    // SCH-10: Generate unique runId for each scheduled invocation
    const runId = uuidv4();
    await queue.upsertJobScheduler(
      `${jobName}-scheduler`,
      { pattern: cron },
      {
        name: jobName,
        data: {
          scheduledAt: new Date().toISOString(),
          runId,
        },
      },
    );

    // Update nextRunAt in DB
    await ScheduleConfig.findOneAndUpdate(
      { jobName },
      { jobName, enabled, cron },
      { upsert: true },
    );

    logger.info(`[Workers] Scheduled cron: ${jobName} — ${cron}`, { runId });
  }
}

/**
 * Gracefully close all workers
 */
export async function closeAllWorkers(): Promise<void> {
  logger.info(`[Workers] Closing ${workers.length} workers...`);
  await Promise.all(workers.map((w) => w.close()));
  logger.info('[Workers] All workers closed');
}
