/**
 * Shared HTTP health server for BullMQ microservices.
 * Provides /health, /healthz, and /ready endpoints.
 */

import http from 'http';

let isHealthy = true;

export function setHealthy(healthy: boolean): void {
  isHealthy = healthy;
}

export function startHealthServer(
  port: number = 3001,
  logFn?: { info: (msg: string) => void },
): http.Server {
  const log = logFn || { info: console.log };

  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/healthz') {
      if (isHealthy) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'unhealthy' }));
      }
    } else if (req.url === '/ready') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ready' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, () => {
    log.info(`[Health] Server listening on port ${port}`);
  });

  return server;
}
