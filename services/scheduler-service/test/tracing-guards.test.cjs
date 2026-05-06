/**
 * Workspace-level tracing consistency guards.
 *
 * Verifies that all HTTP services:
 *   1. Have a `src/middleware/tracing.ts` file
 *   2. Import and use `tracingMiddleware` in their main HTTP entrypoint
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

// Each entry: [service dir, main HTTP file relative to service src/]
const services = [
  ['rez-auth-service',        'index.ts'],
  ['rez-wallet-service',      'index.ts'],
  ['rez-payment-service',     'index.ts'],
  ['rez-order-service',       'httpServer.ts'],
  ['rez-catalog-service',     'httpServer.ts'],
  ['rez-gamification-service','httpServer.ts'],
  ['rez-search-service',      'index.ts'],
  ['rez-marketing-service',   'index.ts'],
  ['rez-ads-service',         'index.ts'],
  ['rez-merchant-service',    'index.ts'],
];

for (const [svc, mainFile] of services) {
  test(`${svc} has middleware/tracing.ts`, () => {
    const tracingPath = path.join(root, svc, 'src', 'middleware', 'tracing.ts');
    assert.ok(fs.existsSync(tracingPath), `missing: ${tracingPath}`);
  });

  test(`${svc} imports and uses tracingMiddleware in ${mainFile}`, () => {
    const mainPath = path.join(root, svc, 'src', mainFile);
    const source = fs.readFileSync(mainPath, 'utf8');
    assert.match(source, /tracingMiddleware/, `${svc}/${mainFile} must reference tracingMiddleware`);
    assert.match(source, /from ['"]\.\/middleware\/tracing['"]/, `${svc}/${mainFile} must import from ./middleware/tracing`);
  });
}
