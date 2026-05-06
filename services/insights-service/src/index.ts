import express, { Request, Response, NextFunction } from 'express';
import { env } from './config/env';
import { connectMongoDB, disconnectMongoDB } from './config/mongodb';
import { connectRedis, disconnectRedis, getRedis } from './config/redis';
import { initSentry } from './config/sentry';
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth';
import { rateLimiter } from './middleware/rateLimiter';
import insightsRoutes from './routes/insights.routes';

// Initialize Sentry
initSentry();

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  const start = Date.now();
  _res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${_res.statusCode} [${duration}ms]`);
  });
  next();
});

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  service: string;
  version: string;
  mongoStatus?: string;
  redisStatus?: string;
}

app.get('/health', async (_req: Request, res: Response) => {
  const health: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'rez-insights-service',
    version: '1.0.0',
  };

  try {
    const mongoStatus = require('mongoose').connection.readyState;
    health.mongoStatus = mongoStatus === 1 ? 'connected' : 'disconnected';

    const redis = getRedis();
    const redisPing = await redis.ping();
    health.redisStatus = redisPing === 'PONG' ? 'connected' : 'error';
  } catch (error) {
    health.status = 'degraded';
    console.error('Health check error:', error);
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

app.get('/ready', async (_req: Request, res: Response) => {
  try {
    const mongoStatus = require('mongoose').connection.readyState;
    if (mongoStatus !== 1) {
      res.status(503).json({ ready: false, error: 'MongoDB not connected' });
      return;
    }

    const redis = getRedis();
    await redis.ping();

    res.status(200).json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false, error: 'Service not ready' });
  }
});

app.get('/metrics', (_req: Request, res: Response) => {
  const metrics = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  };
  res.json(metrics);
});

app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'rez-insights-service',
    version: '1.0.0',
    endpoints: ['/health', '/ready', '/metrics'],
  });
});

app.use('/api/insights', insightsRoutes);

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down gracefully...');
  await disconnectMongoDB();
  await disconnectRedis();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const PORT = parseInt(process.env.PORT || '3011', 10);

async function start() {
  try {
    await connectMongoDB();
    await connectRedis();

    app.listen(PORT, () => {
      console.log(`Rez Insights Service running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

// ── Global Error Handlers ─────────────────────────────────────────────────
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

export default app;
