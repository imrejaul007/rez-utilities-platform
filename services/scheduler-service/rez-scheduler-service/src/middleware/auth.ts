// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../config/logger';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        serviceId?: string;
      };
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.get('Authorization');
  if (!authHeader) {
    // Try internal service token
    const serviceToken = req.get('X-Service-Token');
    if (serviceToken) {
      verifyServiceToken(serviceToken, req, res, next);
      return;
    }

    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.replace('Bearer ', '');

  if (process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as { id: string };
      req.user = { id: decoded.id };
      next();
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('[Auth] JWT verification failed', { error: msg });
    }
  }

  res.status(401).json({ error: 'Invalid token' });
}

function verifyServiceToken(token: string, req: Request, res: Response, next: NextFunction): void {
  if (process.env.INTERNAL_SERVICE_TOKENS_JSON) {
    try {
      const tokens = JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON);
      if (tokens[token]) {
        req.user = { serviceId: token };
        next();
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('[Auth] Failed to parse service tokens', { error: msg });
    }
  }

  if (process.env.INTERNAL_SERVICE_TOKEN) {
    const inputBuf = Buffer.from(token);
    const secretBuf = Buffer.from(process.env.INTERNAL_SERVICE_TOKEN);
    if (inputBuf.length === secretBuf.length && crypto.timingSafeEqual(inputBuf, secretBuf)) {
      req.user = { serviceId: 'internal' };
      next();
      return;
    }
  }

  res.status(401).json({ error: 'Invalid service token' });
}
