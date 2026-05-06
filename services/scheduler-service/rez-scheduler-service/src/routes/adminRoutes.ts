// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config, JobName } from '../config/index';
import { JobLog } from '../models/JobLog';
import { ScheduleConfig } from '../models/ScheduleConfig';
import { createQueue, getAllQueues } from '../queues/index';
import { logger } from '../config/logger';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// ─── SCHEDULER-P0 FIX: Apply authMiddleware to ALL admin routes ───────────────
// All job management, trigger, config, and health endpoints expose internal state.
// Require either a valid JWT or a registered internal service token.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/scheduler/jobs
 * List all registered jobs with their status, cron, and last run info
 */
router.get('/jobs', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  try {
    const jobNames = Object.keys(config.jobs) as JobName[];
    const scheduleConfigs = await ScheduleConfig.find({});
    const configMap = new Map(scheduleConfigs.map((c) => [c.jobName, c]));

    const jobs = jobNames.map((name) => {
      const jobDef = config.jobs[name];
      const schedConf = configMap.get(name);
      return {
        name,
        description: jobDef?.description || '',
        cron: schedConf?.cronOverride || jobDef?.cron || '',
        enabled: schedConf?.enabled ?? true,
        lastRunAt: schedConf?.lastRunAt || null,
        nextRunAt: schedConf?.nextRunAt || null,
        runCount: schedConf?.runCount || 0,
        failCount: schedConf?.failCount || 0,
      };
    });

    res.json({ success: true, data: jobs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[GET /jobs] Error listing jobs', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/scheduler/jobs/:name/logs
 * Get execution logs for a specific job
 */
router.get('/jobs/:name/logs', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, error: 'Job name is required' });
      return;
    }
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 20), 100);
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      JobLog.find({ jobName: name }).sort({ startedAt: -1 }).skip(skip).limit(limit).lean(),
      JobLog.countDocuments({ jobName: name }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[GET /jobs/:name/logs] Error fetching logs', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/scheduler/jobs/:name/trigger
 * Manually trigger a job immediately
 */
router.post('/jobs/:name/trigger', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;

    if (!config.jobs[name as JobName]) {
      res.status(404).json({ success: false, error: `Job not found: ${name}` });
      return;
    }

    const queue = createQueue(name as JobName);
    const job = await queue.add(name, {
      triggeredManually: true,
      triggeredAt: new Date().toISOString(),
      triggeredBy: req.headers['x-user-id'] || 'admin',
    });

    logger.info(`[POST /jobs/:name/trigger] Manually triggered: ${name}`, { jobId: job.id });

    res.json({
      success: true,
      data: { jobId: job.id, jobName: name, status: 'queued' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[POST /jobs/:name/trigger] Error triggering job', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

const updateConfigSchema = z.object({
  enabled: z.boolean().optional(),
  cronOverride: z
    .string()
    .regex(/^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/, 'Invalid cron expression')
    .optional(),
});

/**
 * PUT /api/scheduler/jobs/:name/config
 * Update a job's runtime config (enable/disable, override cron)
 */
router.put('/jobs/:name/config', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, error: 'Job name is required' });
      return;
    }

    if (!config.jobs[name as JobName]) {
      res.status(404).json({ success: false, error: `Job not found: ${name}` });
      return;
    }

    const parsed = updateConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues });
      return;
    }

    const update: { enabled?: boolean; cronOverride?: string } = {};
    if (parsed.data.enabled !== undefined) update.enabled = parsed.data.enabled;
    if (parsed.data.cronOverride !== undefined) update.cronOverride = parsed.data.cronOverride;

    const scheduleConfig = await ScheduleConfig.findOneAndUpdate(
      { jobName: name },
      { ...update, jobName: name },
      { upsert: true, new: true },
    );

    logger.info(`[PUT /jobs/:name/config] Config updated: ${name}`, update);

    res.json({ success: true, data: scheduleConfig });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[PUT /jobs/:name/config] Error updating config', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/scheduler/health
 * Detailed health check with queue depths and worker status
 */
router.get('/health', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  try {
    const queues = getAllQueues();
    const queueHealth: Record<string, number> = {};

    for (const [name, queue] of queues) {
      const counts = await queue.getJobCounts('active', 'completed', 'delayed', 'failed', 'waiting');
      queueHealth[name] = counts;
    }

    const recentFailures = await JobLog.countDocuments({
      status: 'failed',
      startedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    res.json({
      success: true,
      data: {
        status: recentFailures > 10 ? 'degraded' : 'healthy',
        queues: queueHealth,
        recentFailures24h: recentFailures,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[GET /health] Error checking health', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
