// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
/**
 * Shared job runner utilities — extracted from all 5 processor files (SCH-09).
 *
 * Consolidates:
 *   - logJobStart()        — create a running JobLog entry
 *   - logJobComplete()     — mark JobLog as completed with duration + result
 *   - logJobFailed()       — mark JobLog as failed with error + stack
 *   - updateScheduleConfig() — increment runCount / failCount on ScheduleConfig
 *   - runJob()             — reusable wrapper: lock → log → body → bookkeeping
 *   - paginatedGet()        — fetch all pages from a paginated API
 */

import { Job } from 'bullmq';
import axios, { AxiosInstance } from 'axios';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { JobLog } from '../models/JobLog';
import { ScheduleConfig } from '../models/ScheduleConfig';

// Re-export logger so processors can import it from this file
export { logger } from '../config/logger';

// ─── Job Logging ─────────────────────────────────────────────────────────────

/**
 * Create a running JobLog entry and return the document (used as logId).
 */
export async function logJobStart(jobName: string, jobId: string): Promise<mongoose.Document> {
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

/**
 * Mark a JobLog entry as completed.
 */
export async function logJobComplete(
  logId: mongoose.Types.ObjectId,
  duration: number,
  result?: Record<string, unknown>,
): Promise<void> {
  await JobLog.findByIdAndUpdate(logId, {
    status: 'completed',
    completedAt: new Date(),
    duration,
    result,
  });
}

/**
 * Mark a JobLog entry as failed.
 */
export async function logJobFailed(
  logId: mongoose.Types.ObjectId,
  duration: number,
  error: string,
  stack?: string,
): Promise<void> {
  await JobLog.findByIdAndUpdate(logId, {
    status: 'failed',
    completedAt: new Date(),
    duration,
    error,
    errorStack: stack,
  });
}

// ─── Schedule Config ─────────────────────────────────────────────────────────

/**
 * Increment runCount (on success) or failCount (on failure) on ScheduleConfig.
 */
export async function updateScheduleConfig(jobName: string, success: boolean): Promise<void> {
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

// ─── Shared Axios client ──────────────────────────────────────────────────────

const internalHeaders = (): Record<string, string> => ({
  'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
});

/**
 * Build a pre-configured Axios instance for internal service calls.
 */
export function internalClient(): AxiosInstance {
  return axios.create({
    headers: internalHeaders(),
    timeout: 30000,
  });
}

// ─── Idempotency ─────────────────────────────────────────────────────────────

const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 25 * 60 * 60; // 25 hours — survives a full day + margin

/**
 * Generate an idempotency key scoped to a job run + cycle.
 * @param jobName   - The job name (e.g. "coin-expiry-alerts")
 * @param runId     - UUID for this specific invocation
 * @param cycleKey  - Optional sub-cycle identifier (e.g. "page-1") for page-level dedup
 */
export function buildIdempotencyKey(jobName: string, runId: string, cycleKey?: string): string {
  return cycleKey
    ? `scheduler:idempotency:${jobName}:${runId}:${cycleKey}`
    : `scheduler:idempotency:${jobName}:${runId}`;
}

/**
 * Attempt to claim an idempotency key in Redis.
 * Returns true if this is the first call (key was set); false if already processed.
 */
export async function tryClaimIdempotency(key: string, ttlSeconds: number = DEFAULT_IDEMPOTENCY_TTL_SECONDS): Promise<boolean> {
  const result = await redis.set(key, new Date().toISOString(), 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

/**
 * Skip a job body when idempotency key already exists.
 */
export async function checkIdempotency(jobName: string, runId: string, cycleKey?: string): Promise<boolean> {
  const key = buildIdempotencyKey(jobName, runId, cycleKey);
  const exists = await redis.exists(key);
  if (exists) {
    logger.info(`[Idempotency] Skipping already-processed key: ${key}`);
    return false; // already processed
  }
  return true; // fresh — proceed
}

// ─── Paginated API Fetch ─────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
}

/**
 * Fetch all pages from a paginated API endpoint and concatenate all items.
 * Stops on the first page that fails or returns no items.
 */
export async function fetchAllPages<T>(
  baseUrl: string,
  params: Record<string, unknown>,
  pageSize: number = 100,
  headers: Record<string, string> = {},
): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await axios.get<PaginatedResponse<T>>(baseUrl, {
      params: { ...params, page, pageSize },
      headers: { ...internalHeaders(), ...headers },
      timeout: 60000,
    });

    if (response.status !== 200) {
      throw new Error(`Paginated fetch returned status ${response.status}`);
    }

    const data = response.data;
    if (!data || !Array.isArray(data.items)) {
      break;
    }

    allItems.push(...data.items);
    hasNextPage = data.hasNextPage ?? false;
    page++;

    if (page > 100) {
      // Safety cap — 100 pages × pageSize is plenty
      logger.warn('[JobRunner] fetchAllPages reached safety cap at 100 pages');
      break;
    }
  }

  return allItems;
}

// ─── Core Job Runner Wrapper ──────────────────────────────────────────────────

export interface JobRunContext {
  job: Job;
  jobName: string;
  runId: string;
}

/**
 * Universal job runner: acquires a distributed lock, creates a JobLog entry,
 * executes the body, and updates bookkeeping on both success and failure.
 *
 * Use this instead of open-coding try/catch/finally in every processor.
 *
 * @param ctx         - Job run context (job, jobName, runId)
 * @param lockName    - Redis key suffix for the distributed lock
 * @param body        - Async function to execute while holding the lock
 * @param ttlSeconds  - Distributed lock TTL (default: 30 min for SCH-14)
 */
export async function runJob(
  ctx: JobRunContext,
  lockName: string,
  body: () => Promise<Record<string, unknown> | void>,
  ttlSeconds: number = 1800,
): Promise<boolean> {
  const { job, jobName, runId } = ctx;
  const { runWithLock } = await import('../config/distributedLock');

  const acquired = await runWithLock(lockName, async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart(jobName, job.id || '');
    try {
      logger.info(`[JobRunner] Starting ${jobName}`, { runId, jobId: job.id });
      const result = await body();
      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id as mongoose.Types.ObjectId, duration, result ?? undefined);
      await updateScheduleConfig(jobName, true);
      logger.info(`[JobRunner] ${jobName} completed`, { runId, duration, ...(result ?? {}) });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id as mongoose.Types.ObjectId, duration, error, stack);
      await updateScheduleConfig(jobName, false);
      logger.error(`[JobRunner] ${jobName} failed`, { runId, error, duration });
      throw err;
    }
  }, ttlSeconds);

  if (!acquired) {
    logger.info(`[JobRunner] Skipping ${jobName} — lock held by another instance`, { runId });
  }

  return acquired;
}

/**
 * Generate a new UUID runId for a job invocation.
 */
export function newRunId(): string {
  return uuidv4();
}
