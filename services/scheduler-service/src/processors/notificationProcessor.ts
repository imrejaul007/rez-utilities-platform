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
      { lastRunAt: new Date(), $inc: { runCount: 1 } },
      { upsert: true },
    );
  } else {
    await ScheduleConfig.findOneAndUpdate(
      { jobName },
      { $inc: { failCount: 1 } },
      { upsert: true },
    );
  }
}

// RC-46-3/RC-46-9: All notification processors now use distributed locks
// to prevent duplicate execution across multiple scheduler pods.

/**
 * Send weekly digest emails to users (Monday 9 AM)
 */
export async function digestEmail(job: Job): Promise<void> {
  const acquired = await runWithLock('digest-email', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('digest-email', job.id || '');

    try {
      logger.info('[Notification] Starting weekly digest email');

      const response = await axios.post(
        `${config.services.notificationService}/api/internal/digest/send`,
        {
          type: 'weekly',
          targetDate: new Date().toISOString().slice(0, 10),
        },
        {
          headers: {
            'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
          timeout: 60000,
        },
      );

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, {
        emailsSent: response.data.sent,
        skipped: response.data.skipped,
      });
      await updateScheduleConfig('digest-email', true);

      logger.info('[Notification] Digest email completed', {
        sent: response.data.sent,
        duration,
      });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('digest-email', false);
      logger.error('[Notification] Digest email failed', { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[Notification] Skipping digest-email — lock held by another instance');
  }
}

/**
 * Daily coin expiry alerts: query wallets for coins expiring within 7 days,
 * then notify users via the notification service.
 */
export async function coinExpiryAlerts(job: Job): Promise<void> {
  const acquired = await runWithLock('coin-expiry-alerts', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('coin-expiry-alerts', job.id || '');

    try {
      logger.info('[Notification] Starting coin expiry alerts');

      const walletResponse = await axios.get(
        `${config.services.walletService}/api/internal/coins/expiring`,
        {
          params: { withinDays: 7 },
          headers: {
            'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
          timeout: 30000,
        },
      );

      const expiringCoins = walletResponse.data?.items || [];

      if (expiringCoins.length === 0) {
        const duration = Date.now() - startTime;
        await logJobComplete(logEntry._id, duration, { alertsSent: 0 });
        await updateScheduleConfig('coin-expiry-alerts', true);
        logger.info('[Notification] No expiring coins found', { duration });
        return;
      }

      const notifResponse = await axios.post(
        `${config.services.notificationService}/api/internal/coin-expiry/notify`,
        { expiringCoins },
        {
          headers: {
            'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
          timeout: 60000,
        },
      );

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, {
        alertsSent: notifResponse.data.sent,
        coinsExpiring: expiringCoins.length,
      });
      await updateScheduleConfig('coin-expiry-alerts', true);

      logger.info('[Notification] Coin expiry alerts completed', {
        sent: notifResponse.data.sent,
        coinsExpiring: expiringCoins.length,
        duration,
      });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('coin-expiry-alerts', false);
      logger.error('[Notification] Coin expiry alerts failed', { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[Notification] Skipping coin-expiry-alerts — lock held by another instance');
  }
}

/**
 * Process batched push notifications every 5 minutes
 */
export async function pushNotificationBatch(job: Job): Promise<void> {
  const acquired = await runWithLock('push-notification-batch', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('push-notification-batch', job.id || '');

    try {
      logger.info('[Notification] Starting push notification batch');

      const response = await axios.post(
        `${config.services.notificationService}/api/internal/push/batch`,
        { batchSize: 500 },
        {
          headers: {
            'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
          timeout: 30000,
        },
      );

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, {
        notificationsSent: response.data.sent,
        failed: response.data.failed,
      });
      await updateScheduleConfig('push-notification-batch', true);

      logger.info('[Notification] Push notification batch completed', {
        sent: response.data.sent,
        failed: response.data.failed,
        duration,
      });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('push-notification-batch', false);
      logger.error('[Notification] Push notification batch failed', { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[Notification] Skipping push-notification-batch — lock held by another instance');
  }
}
