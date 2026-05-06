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

// RC-46-3/RC-46-9: All cleanup processors now use distributed locks
// to prevent duplicate execution across multiple scheduler pods.

export async function expiredOtpCleanup(job: Job): Promise<void> {
  const acquired = await runWithLock('expired-otp-cleanup', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('expired-otp-cleanup', job.id || '');

    try {
      logger.info('[Cleanup] Starting expired OTP cleanup');

      const response = await axios.post(
        `${config.services.merchantService}/api/internal/otp/cleanup`,
        { olderThanHours: 24 },
        {
          headers: {
            'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
          timeout: 30000,
        },
      );

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { otpsDeleted: response.data.count });
      await updateScheduleConfig('expired-otp-cleanup', true);

      logger.info('[Cleanup] Expired OTP cleanup completed', { count: response.data.count, duration });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('expired-otp-cleanup', false);
      logger.error('[Cleanup] Expired OTP cleanup failed', { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[Cleanup] Skipping expired-otp-cleanup — lock held by another instance');
  }
}

export async function sessionCleanup(job: Job): Promise<void> {
  const acquired = await runWithLock('session-cleanup', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('session-cleanup', job.id || '');

    try {
      logger.info('[Cleanup] Starting session cleanup');

      const response = await axios.post(
        `${config.services.walletService}/api/internal/sessions/cleanup`,
        { olderThanHours: 168 },
        {
          headers: {
            'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
          timeout: 30000,
        },
      );

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { sessionsDeleted: response.data.count });
      await updateScheduleConfig('session-cleanup', true);

      logger.info('[Cleanup] Session cleanup completed', { count: response.data.count, duration });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('session-cleanup', false);
      logger.error('[Cleanup] Session cleanup failed', { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[Cleanup] Skipping session-cleanup — lock held by another instance');
  }
}

export async function tempFileCleanup(job: Job): Promise<void> {
  const acquired = await runWithLock('temp-file-cleanup', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('temp-file-cleanup', job.id || '');

    try {
      logger.info('[Cleanup] Starting temp file cleanup');

      const response = await axios.post(
        `${config.services.orderService}/api/internal/temp-files/cleanup`,
        { olderThanDays: 7 },
        {
          headers: {
            'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
          timeout: 30000,
        },
      );

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { filesDeleted: response.data.count });
      await updateScheduleConfig('temp-file-cleanup', true);

      logger.info('[Cleanup] Temp file cleanup completed', { count: response.data.count, duration });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('temp-file-cleanup', false);
      logger.error('[Cleanup] Temp file cleanup failed', { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[Cleanup] Skipping temp-file-cleanup — lock held by another instance');
  }
}

export async function auditLogArchival(job: Job): Promise<void> {
  const acquired = await runWithLock('audit-log-archival', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('audit-log-archival', job.id || '');

    try {
      logger.info('[Cleanup] Starting audit log archival');

      const response = await axios.post(
        `${config.services.merchantService}/api/internal/audit-logs/archive`,
        { olderThanDays: 90 },
        {
          headers: {
            'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
          timeout: 30000,
        },
      );

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { logsArchived: response.data.count });
      await updateScheduleConfig('audit-log-archival', true);

      logger.info('[Cleanup] Audit log archival completed', { count: response.data.count, duration });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('audit-log-archival', false);
      logger.error('[Cleanup] Audit log archival failed', { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[Cleanup] Skipping audit-log-archival — lock held by another instance');
  }
}
