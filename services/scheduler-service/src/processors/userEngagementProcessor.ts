// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
import { Job } from 'bullmq';
import axios from 'axios';
import mongoose from 'mongoose';
import { logger } from '../config/logger';
import { JobLog } from '../models/JobLog';
import { ScheduleConfig } from '../models/ScheduleConfig';
import { config } from '../config/index';
import { runWithLock } from '../config/distributedLock';

async function logJobStart(jobName: string, jobId: string): Promise<mongoose.Document> {
  const log = new JobLog({
    jobName,
    status: 'running',
    startedAt: new Date(),
    attempts: 0,
    metadata: { bullJobId: jobId },
  });
  await log.save();
  return log;
}

async function logJobComplete(logId: mongoose.Types.ObjectId, duration: number, result?: Record<string, unknown>): Promise<void> {
  await JobLog.findByIdAndUpdate(logId, {
    status: 'completed',
    completedAt: new Date(),
    duration,
    result,
  });
}

async function logJobFailed(logId: mongoose.Types.ObjectId, duration: number, error: string, stack?: string): Promise<void> {
  await JobLog.findByIdAndUpdate(logId, {
    status: 'failed',
    completedAt: new Date(),
    duration,
    error,
    errorStack: stack,
  });
}

async function updateScheduleConfig(jobName: string, success: boolean): Promise<void> {
  if (success) {
    await ScheduleConfig.findOneAndUpdate(
      { jobName },
      {
        lastRunAt: new Date(),
        $inc: { runCount: 1 },
      },
      { upsert: true },
    );
  } else {
    await ScheduleConfig.findOneAndUpdate(
      { jobName },
      {
        $inc: { failCount: 1 },
      },
      { upsert: true },
    );
  }
}

// RC-46-3/RC-46-9: All user engagement processors now use distributed locks
// to prevent duplicate execution across multiple scheduler pods.

export async function creditScoreRefresh(job: Job): Promise<void> {
  const acquired = await runWithLock('credit-score-refresh', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('credit-score-refresh', job.id || '');

    try {
      logger.info('[UserEngagement] Starting weekly credit score refresh');

      const response = await axios.post(
        `${config.services.walletService}/internal/credit/refresh`,
        { batchSize: 1000 },
        {
          headers: {
            'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
          timeout: 60000,
        },
      );

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { usersRefreshed: response.data.count });
      await updateScheduleConfig('credit-score-refresh', true);

      logger.info('[UserEngagement] Credit score refresh completed', { count: response.data.count, duration });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('credit-score-refresh', false);
      logger.error('[UserEngagement] Credit score refresh failed', { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[UserEngagement] Skipping credit-score-refresh — lock held by another instance');
  }
}

export async function loyaltyPointsExpiry(job: Job): Promise<void> {
  const acquired = await runWithLock('loyalty-points-expiry', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('loyalty-points-expiry', job.id || '');

    try {
      logger.info('[UserEngagement] Starting loyalty points expiry check');

      const response = await axios.post(
        `${config.services.walletService}/api/internal/loyalty/expire-points`,
        { dryRun: false },
        {
          headers: {
            'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
          timeout: 30000,
        },
      );

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { pointsExpired: response.data.count });
      await updateScheduleConfig('loyalty-points-expiry', true);

      logger.info('[UserEngagement] Loyalty points expiry check completed', { count: response.data.count, duration });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('loyalty-points-expiry', false);
      logger.error('[UserEngagement] Loyalty points expiry failed', { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[UserEngagement] Skipping loyalty-points-expiry — lock held by another instance');
  }
}

export async function campaignExpiry(job: Job): Promise<void> {
  const acquired = await runWithLock('campaign-expiry', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('campaign-expiry', job.id || '');

    try {
      logger.info('[UserEngagement] Checking for expired campaigns');

      const response = await axios.post(
        `${config.services.merchantService}/api/internal/campaigns/expire`,
        { autoExpire: true },
        {
          headers: {
            'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
          timeout: 30000,
        },
      );

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { campaignsExpired: response.data.count });
      await updateScheduleConfig('campaign-expiry', true);

      logger.info('[UserEngagement] Campaign expiry check completed', { count: response.data.count, duration });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('campaign-expiry', false);
      logger.error('[UserEngagement] Campaign expiry check failed', { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[UserEngagement] Skipping campaign-expiry — lock held by another instance');
  }
}

export async function abandonedCartReminder(job: Job): Promise<void> {
  const acquired = await runWithLock('abandoned-cart-reminder', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('abandoned-cart-reminder', job.id || '');

    try {
      logger.info('[UserEngagement] Sending abandoned cart reminders');

      const response = await axios.post(
        `${config.services.orderService}/api/internal/carts/send-reminders`,
        { hoursThreshold: 2 },
        {
          headers: {
            'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
          timeout: 30000,
        },
      );

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { remindersSent: response.data.count });
      await updateScheduleConfig('abandoned-cart-reminder', true);

      logger.info('[UserEngagement] Abandoned cart reminders sent', { count: response.data.count, duration });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('abandoned-cart-reminder', false);
      logger.error('[UserEngagement] Abandoned cart reminder failed', { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[UserEngagement] Skipping abandoned-cart-reminder — lock held by another instance');
  }
}

export async function profileRefresh(job: Job): Promise<void> {
  const acquired = await runWithLock('profile-refresh', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('profile-refresh', job.id || '');

    try {
      logger.info('[UserEngagement] Starting weekly profile engagement refresh');

      const response = await axios.post(
        `${config.services.authService}/internal/profile/refresh`,
        { batchSize: 1000 },
        {
          headers: {
            'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
          timeout: 60000,
        },
      );

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { profilesRefreshed: response.data.count });
      await updateScheduleConfig('profile-refresh', true);

      logger.info('[UserEngagement] Profile engagement refresh completed', { count: response.data.count, duration });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('profile-refresh', false);
      logger.error('[UserEngagement] Profile engagement refresh failed', { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[UserEngagement] Skipping profile-refresh — lock held by another instance');
  }
}

export async function bnplOverdueProcessing(job: Job): Promise<void> {
  const acquired = await runWithLock('bnpl-overdue-processing', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('bnpl-overdue-processing', job.id || '');

    try {
      logger.info('[UserEngagement] Starting daily BNPL overdue processing');

      const response = await axios.post(
        `${config.services.walletService}/internal/credit/process-overdue`,
        {},
        {
          headers: {
            'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
          timeout: 60000,
        },
      );

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { processedCount: response.data.count });
      await updateScheduleConfig('bnpl-overdue-processing', true);

      logger.info('[UserEngagement] BNPL overdue processing completed', { count: response.data.count, duration });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('bnpl-overdue-processing', false);
      logger.error('[UserEngagement] BNPL overdue processing failed', { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[UserEngagement] Skipping bnpl-overdue-processing — lock held by another instance');
  }
}
