/**
 * Distributed Lock Utility for Scheduler Service (SCH-14)
 *
 * Prevents duplicate job execution across multiple scheduler pods.
 * Uses Redis SET NX EX (atomic acquire) + Lua script (safe release).
 *
 * SCH-14 Changes:
 *   - TTL increased from 300s (5 min) to 1800s (30 min)
 *   - Added renewable lock pattern: the lock is periodically refreshed
 *     while the job body is running, preventing premature expiry on long jobs
 */

import { redis } from './redis';
import { logger } from './logger';

// SCH-14: Increased from 300 to 1800 seconds (30 minutes)
export const DEFAULT_LOCK_TTL_SECONDS = 1800;
const RENEW_INTERVAL_MS = 5 * 60 * 1000; // renew every 5 minutes
const RENEWAL_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("expire", KEYS[1], ARGV[2])
  else
    return 0
  end
`;

/**
 * Execute a function with a distributed lock.
 * If the lock cannot be acquired (another pod holds it), the function is skipped.
 *
 * The lock is automatically renewed every 5 minutes while the body runs,
 * preventing premature expiry for long-running jobs.
 *
 * @param jobName     - Unique identifier for the job (used as Redis key suffix)
 * @param fn          - The async function to run while holding the lock
 * @param ttlSeconds  - Lock TTL in seconds (default: 1800 = 30 minutes for SCH-14)
 * @returns true if lock was acquired and fn executed; false if skipped
 */
export async function runWithLock<T = void>(
  jobName: string,
  fn: () => Promise<T>,
  ttlSeconds: number = DEFAULT_LOCK_TTL_SECONDS,
): Promise<boolean> {
  const lockKey = `scheduler:lock:${jobName}`;
  const lockValue = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const acquired = await redis.set(lockKey, lockValue, 'EX', ttlSeconds, 'NX');
  if (acquired !== 'OK') {
    logger.info(`[Lock] Skipping ${jobName} — lock held by another pod`, { jobName });
    return false;
  }

  // SCH-14: Renewable lock — start background renewal interval
  let renewInterval: ReturnType<typeof setInterval> | null = null;
  let settled = false;

  const startRenewal = () => {
    renewInterval = setInterval(async () => {
      try {
        const renewed = await redis.eval(RENEWAL_SCRIPT, 1, lockKey, lockValue, ttlSeconds.toString());
        if (renewed !== 1) {
          logger.warn(`[Lock] Renewal failed for ${jobName} — lock was taken over`, { lockKey });
          settled = true;
          if (renewInterval) clearInterval(renewInterval);
        }
      } catch (err: unknown) {
        logger.warn(`[Lock] Renewal error for ${jobName}: ${(err as Error)?.message ?? String(err)}`);
      }
    }, RENEW_INTERVAL_MS);
  };

  const stopRenewal = () => {
    if (renewInterval) {
      clearInterval(renewInterval);
      renewInterval = null;
    }
  };

  startRenewal();

  try {
    await fn();
    return true;
  } finally {
    settled = true;
    stopRenewal();

    // Safe release: only delete if we still own the lock
    const releaseScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      await redis.eval(releaseScript, 1, lockKey, lockValue);
    } catch (err: unknown) {
      logger.warn(`[Lock] Failed to release lock for ${jobName} (will expire via TTL): ${(err as Error)?.message ?? String(err)}`);
    }
  }
}
