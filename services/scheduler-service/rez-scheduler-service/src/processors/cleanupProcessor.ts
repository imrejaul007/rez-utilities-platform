// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
/**
 * Cleanup Processors (SCH-09/13)
 *
 * SCH-09: import shared job runner utilities from src/lib/jobRunner
 * SCH-13: Zod validation + response.status checks on all downstream calls
 */
import { Job } from 'bullmq';
import { z } from 'zod';
import { logger, internalClient } from '../lib/jobRunner';
import {
  logJobStart,
  logJobComplete,
  logJobFailed,
  updateScheduleConfig,
} from '../lib/jobRunner';
import { runWithLock } from '../config/distributedLock';
import { config } from '../config/index';

// ─── Response schemas (SCH-13) ────────────────────────────────────────────────

const OtpCleanupResponse = z.object({ count: z.number() });
type OtpCleanupResponse = z.infer<typeof OtpCleanupResponse>;

const SessionCleanupResponse = z.object({ count: z.number() });
type SessionCleanupResponse = z.infer<typeof SessionCleanupResponse>;

const TempFileCleanupResponse = z.object({ count: z.number() });
type TempFileCleanupResponse = z.infer<typeof TempFileCleanupResponse>;

const AuditLogArchivalResponse = z.object({ count: z.number() });
type AuditLogArchivalResponse = z.infer<typeof AuditLogArchivalResponse>;

export async function expiredOtpCleanup(job: Job): Promise<void> {
  const acquired = await runWithLock('expired-otp-cleanup', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('expired-otp-cleanup', job.id || '');

    try {
      logger.info('[Cleanup] Starting expired OTP cleanup');

      // SCH-13: check response.status before accessing data
      const response = await internalClient().post<OtpCleanupResponse>(
        `${config.services.merchantService}/api/internal/otp/cleanup`,
        { olderThanHours: 24 },
        { timeout: 30000 },
      );

      if (response.status !== 200) {
        throw new Error(`expiredOtpCleanup received unexpected status ${response.status}`);
      }

      const parsed = OtpCleanupResponse.safeParse(response.data);
      if (!parsed.success) {
        throw new Error(`expiredOtpCleanup Zod validation failed: ${parsed.error.message}`);
      }

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { otpsDeleted: parsed.data.count });
      await updateScheduleConfig('expired-otp-cleanup', true);

      logger.info('[Cleanup] Expired OTP cleanup completed', { count: parsed.data.count, duration });
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

      // SCH-13: check response.status before accessing data
      const response = await internalClient().post<SessionCleanupResponse>(
        `${config.services.walletService}/api/internal/sessions/cleanup`,
        { olderThanHours: 168 },
        { timeout: 30000 },
      );

      if (response.status !== 200) {
        throw new Error(`sessionCleanup received unexpected status ${response.status}`);
      }

      const parsed = SessionCleanupResponse.safeParse(response.data);
      if (!parsed.success) {
        throw new Error(`sessionCleanup Zod validation failed: ${parsed.error.message}`);
      }

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { sessionsDeleted: parsed.data.count });
      await updateScheduleConfig('session-cleanup', true);

      logger.info('[Cleanup] Session cleanup completed', { count: parsed.data.count, duration });
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

      // SCH-13: check response.status before accessing data
      const response = await internalClient().post<TempFileCleanupResponse>(
        `${config.services.orderService}/api/internal/temp-files/cleanup`,
        { olderThanDays: 7 },
        { timeout: 30000 },
      );

      if (response.status !== 200) {
        throw new Error(`tempFileCleanup received unexpected status ${response.status}`);
      }

      const parsed = TempFileCleanupResponse.safeParse(response.data);
      if (!parsed.success) {
        throw new Error(`tempFileCleanup Zod validation failed: ${parsed.error.message}`);
      }

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { filesDeleted: parsed.data.count });
      await updateScheduleConfig('temp-file-cleanup', true);

      logger.info('[Cleanup] Temp file cleanup completed', { count: parsed.data.count, duration });
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

      // SCH-13: check response.status before accessing data
      const response = await internalClient().post<AuditLogArchivalResponse>(
        `${config.services.merchantService}/api/internal/audit-logs/archive`,
        { olderThanDays: 90 },
        { timeout: 30000 },
      );

      if (response.status !== 200) {
        throw new Error(`auditLogArchival received unexpected status ${response.status}`);
      }

      const parsed = AuditLogArchivalResponse.safeParse(response.data);
      if (!parsed.success) {
        throw new Error(`auditLogArchival Zod validation failed: ${parsed.error.message}`);
      }

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { logsArchived: parsed.data.count });
      await updateScheduleConfig('audit-log-archival', true);

      logger.info('[Cleanup] Audit log archival completed', { count: parsed.data.count, duration });
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
