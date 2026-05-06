// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
import { Request, Response, NextFunction } from 'express';

export function tracingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Extract W3C traceparent header if present and propagate it
  const traceparent = req.get('traceparent');
  if (traceparent) {
    res.setHeader('traceparent', traceparent);
  }
  next();
}
