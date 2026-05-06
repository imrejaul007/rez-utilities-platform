/**
 * Distributed Lock Utility for Scheduler Service
 *
 * Prevents duplicate job execution across multiple scheduler pods.
 * Uses Redis SET NX EX (atomic acquire) + Lua script (safe release).
 */

import crypto from 'crypto';
import { redis } from './redis';
import { logger } from './logger';

const DEFAULT_LOCK_TTL_SECONDS = 300; // 5 minute safety net

/**
 * Execute a function with a distributed lock.
 * If the lock cannot be acquired (another pod holds it), the function is skipped.
 *
 * @param jobName   - Unique identifier for the job (used as Redis key suffix)
 * @param fn        - The async function to run while holding the lock
 * @param ttlSeconds - Lock TTL in seconds (default: 300 = 5 minutes)
 * @returns true if lock was acquired and fn executed; false if skipped
 */
export async function runWithLock<T = void>(
  jobName: string,
  fn: () => Promise<T>,
  ttlSeconds: number = DEFAULT_LOCK_TTL_SECONDS,
): Promise<boolean> {
  const lockKey = `scheduler:lock:${jobName}`;
  // SEC-004 FIX: Use crypto.randomBytes for secure unpredictable lock values
  // Previous Math.random() was predictable and could lead to lock contention race conditions
  const lockValue = `${process.pid}-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;

  const acquired = await redis.set(lockKey, lockValue, 'EX', ttlSeconds, 'NX');
  if (acquired !== 'OK') {
    logger.info(`[Lock] Skipping ${jobName} — lock held by another pod`, { jobName });
    return false;
  }

  try {
    await fn();
    return true;
  } finally {
    const releaseScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      await redis.eval(releaseScript, 1, lockKey, lockValue);
    } catch (err: any) {
      logger.warn(`[Lock] Failed to release lock for ${jobName} (will expire via TTL): ${err?.message}`);
    }
  }
}
