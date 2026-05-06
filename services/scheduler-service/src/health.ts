// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
import http from 'http';
import mongoose from 'mongoose';
import { redis } from './config/redis';
import { logger } from './config/logger';
import { DLQMonitor } from './dlqMonitor';

export function startHealthServer(port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    // Liveness — is the process alive?
    if (req.url === '/health/live') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'alive', timestamp: new Date().toISOString() }));
      return;
    }

    // Readiness — can the service handle requests?
    if (req.url === '/health/ready') {
      const checks: Record<string, string> = {};
      let ready = true;

      try {
        if (mongoose.connection.readyState !== 1) throw new Error('not connected');
        await mongoose.connection.db?.admin().ping();
        checks.mongodb = 'ok';
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        checks.mongodb = `error: ${msg}`;
        ready = false;
      }

      try {
        await redis.ping();
        checks.redis = 'ok';
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        checks.redis = `degraded: ${msg}`;
        // Redis degraded is warning not fatal for scheduler
      }

      res.writeHead(ready ? 200 : 503);
      res.end(JSON.stringify({
        status: ready ? 'ready' : 'degraded',
        checks,
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    // Detailed health check — comprehensive status with latency metrics
    if (req.url === '/health/detailed') {
      const checks: Record<string, any> = {};
      let isHealthy = true;

      // MongoDB check with latency
      const mongoStart = Date.now();
      try {
        if (mongoose.connection.readyState !== 1) throw new Error('not connected');
        await mongoose.connection.db?.admin().ping();
        checks.database = { status: 'up', latencyMs: Date.now() - mongoStart };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        checks.database = { status: 'down', error: msg, latencyMs: Date.now() - mongoStart };
        isHealthy = false;
      }

      // Redis check with latency
      const redisStart = Date.now();
      try {
        await redis.ping();
        checks.redis = { status: 'up', latencyMs: Date.now() - redisStart };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        checks.redis = { status: 'down', error: msg, latencyMs: Date.now() - redisStart };
        // Redis degraded is warning not fatal for scheduler
      }

      const overallStatus = isHealthy ? 'healthy' : 'unhealthy';
      res.writeHead(isHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.SERVICE_VERSION || '1.0.0',
        uptime: process.uptime(),
        checks,
      }));
      return;
    }

    // DLQ stats endpoint
    if (req.url === '/health/dlq') {
      const dlqMonitor = new DLQMonitor();
      try {
        const [stats, alerts] = await Promise.all([
          dlqMonitor.getStats(),
          dlqMonitor.checkAlerts(),
        ]);
        const totalFailed = stats.reduce((sum, s) => sum + s.failed, 0);
        res.writeHead(alerts.length > 0 ? 200 : 200);
        res.end(JSON.stringify({
          status: alerts.length > 0 ? 'alert' : 'ok',
          totalFailed,
          queues: stats,
          alerts,
          timestamp: new Date().toISOString(),
        }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        res.writeHead(503);
        res.end(JSON.stringify({ status: 'error', error: msg }));
      }
      return;
    }

    // Backward-compat /health endpoint
    if (req.url === '/health' || req.url === '/healthz') {
      try {
        await mongoose.connection.db?.admin().ping();
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok' }));
      } catch {
        res.writeHead(503);
        res.end(JSON.stringify({ status: 'unhealthy' }));
      }
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port, () => logger.debug(`[Health] Listening on :${port}`));
  return server;
}
