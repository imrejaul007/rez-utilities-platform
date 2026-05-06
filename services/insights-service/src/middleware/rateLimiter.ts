import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { env } from '../config/env';

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
  skipFailedRequests?: boolean;
  skip?: (req: Request) => boolean;
}

const defaultConfig: RateLimitConfig = {
  windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
  maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10),
  keyPrefix: 'ratelimit',
  skipFailedRequests: false,
};

async function getRateLimitInfo(key: string): Promise<RateLimitInfo> {
  const client = getRedisClient();
  const data = await client.get(key);

  if (!data) {
    return { count: 0, resetTime: 0 };
  }

  return JSON.parse(data) as RateLimitInfo;
}

async function setRateLimitInfo(key: string, info: RateLimitInfo, ttlSeconds: number): Promise<void> {
  const client = getRedisClient();
  await client.setex(key, ttlSeconds, JSON.stringify(info));
}

function generateKey(req: Request, prefix: string): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userId = req.user?.userId || 'anonymous';
  return `${prefix}:${ip}:${userId}`;
}

export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const finalConfig: RateLimitConfig = { ...defaultConfig, ...config };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (finalConfig.skip?.(req)) {
      next();
      return;
    }

    const key = generateKey(req, finalConfig.keyPrefix || 'ratelimit');
    const now = Date.now();
    const windowStart = now - finalConfig.windowMs;

    try {
      const info = await getRateLimitInfo(key);

      if (info.resetTime > 0 && info.resetTime < now) {
        await setRateLimitInfo(key, { count: 0, resetTime: now + finalConfig.windowMs }, Math.ceil(finalConfig.windowMs / 1000));
        info.count = 0;
        info.resetTime = now + finalConfig.windowMs;
      }

      if (info.count >= finalConfig.maxRequests) {
        const retryAfter = Math.ceil((info.resetTime - now) / 1000);
        res.setHeader('X-RateLimit-Limit', String(finalConfig.maxRequests));
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(info.resetTime / 1000)));
        res.setHeader('Retry-After', String(retryAfter));

        res.status(429).json({
          success: false,
          error: 'Too many requests, please try again later',
          retryAfter,
        });
        return;
      }

      const newCount = info.count + 1;
      const resetTime = info.resetTime > 0 ? info.resetTime : now + finalConfig.windowMs;

      await setRateLimitInfo(key, { count: newCount, resetTime }, Math.ceil(finalConfig.windowMs / 1000));

      res.setHeader('X-RateLimit-Limit', String(finalConfig.maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, finalConfig.maxRequests - newCount)));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));

      if (finalConfig.skipFailedRequests && res.statusCode >= 400) {
        const currentInfo = await getRateLimitInfo(key);
        await setRateLimitInfo(key, { count: currentInfo.count - 1, resetTime }, Math.ceil(finalConfig.windowMs / 1000));
      }

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      next();
    }
  };
}

export const rateLimiter = createRateLimiter();

export function createUserRateLimiter(maxRequests: number = 20) {
  return createRateLimiter({
    maxRequests,
    keyPrefix: 'ratelimit:user',
    windowMs: 60000,
  });
}

export function createStrictRateLimiter(maxRequests: number = 5) {
  return createRateLimiter({
    maxRequests,
    keyPrefix: 'ratelimit:strict',
    windowMs: 60000,
  });
}

export function createBulkRateLimiter(maxRequests: number = 100) {
  return createRateLimiter({
    maxRequests,
    keyPrefix: 'ratelimit:bulk',
    windowMs: 60000,
  });
}

export function ipRateLimiter() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `ratelimit:ip:${ip}`;
    const client = getRedisClient();

    try {
      const count = await client.incr(key);

      if (count === 1) {
        await client.expire(key, 60);
      }

      const ttl = await client.ttl(key);

      res.setHeader('X-RateLimit-IP-Limit', '60');
      res.setHeader('X-RateLimit-IP-Remaining', String(Math.max(0, 60 - count)));
      res.setHeader('X-RateLimit-IP-Reset', String(Math.ceil((Date.now() + ttl * 1000) / 1000)));

      if (count > 60) {
        res.status(429).json({
          success: false,
          error: 'Too many requests from this IP, please try again later',
        });
        return;
      }

      next();
    } catch (error) {
      console.error('IP rate limiter error:', error);
      next();
    }
  };
}
