import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const neon = fs.readFileSync(path.join(root, 'ops/recovery/neon-endpoint.mjs'), 'utf8');
const cloudflare = fs.readFileSync(path.join(root, 'ops/recovery/cloudflare-pages.mjs'), 'utf8');
const routeContract = JSON.parse(fs.readFileSync(path.join(root, 'ops/migration/CLOUDFLARE-ROUTE-PARITY-CONTRACT.json'), 'utf8'));
const worker = fs.readFileSync(path.join(root, 'ops/migration/cloudflare-preview/_worker.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'ops/migration/cloudflare-preview/build-preview.mjs'), 'utf8');

test('Neon adapter defaults to inspect and gates all provider mutation', () => {
  assert.match(neon, /BECK_RECOVERY_ACTION \\|\\| 'inspect'/);
  assert.match(neon, /BECK_ALLOW_PRODUCTION_RECOVERY === 'true'/);
  assert.match(neon, /if \\(!mutationAllowed\\)/);
  assert.match(neon, /No POST retry was attempted/);
  assert.match(neon, /database_write_readback_verified: false/);
  assert.match(neon, /const base = 'https:\\/\\/console\\.neon\\.tech\\/api\\/v2'/);
});

test('Cloudflare adapter defaults to inspect and allowlists deploy-hook mutations', () => {
  assert.match(cloudflare, /BECK_RECOVERY_ACTION \\|\\| 'inspect'/);
  assert.match(cloudflare, /BECK_ALLOW_PRODUCTION_RECOVERY === 'true'/);
  assert.match(cloudflare, /if \\(!mutationAllowed\\)/);
  assert.match(cloudflare, /api\\.cloudflare\\.com/);
  assert.match(cloudflare, /pages\\/webhooks\\/deploy_hooks/);
  assert.match(cloudflare, /No automatic POST retry/);
});

test('Cloudflare route contract includes every money-sensitive route and stays blocked', () => {
  assert.equal(routeContract.status, 'BLOCKED_UNTIL_IMPLEMENTED_AND_PROBED');
  assert.match(routeContract.compatibility_rule, /static-only upload is not a valid migration/i);
  const routes = routeContract.routes.map(r => r.path);
  for (const required of ['/healthz','/version','/api/products','/api/offers','/api/toll/v1/manifest','/api/webhooks/stripe','/mtg/','/silos/mtg/silo.json','/data/mtg-catalog.json']) {
    assert.ok(routes.includes(required), 'missing route ' + required);
  }
  assert.ok(routeContract.cutover_gates.some(g => /explicit approval before production DNS/.test(g)));
  assert.equal(routeContract.current_production_mutation, false);
  assert.equal(routeContract.verified_revenue_nzd, 0);
});

test('Cloudflare preview scaffold fails closed for dynamic routes and serves assets only through ASSETS binding', () => {
  assert.match(worker, /status: 'BLOCKED_ROUTE_NOT_MIGRATED'/);
  assert.match(worker, /status:\s*503/);
  assert.match(worker, /env\.ASSETS\.fetch\(request\)/);
  assert.match(worker, /api\\/webhooks\\/stripe/);
  assert.match(builder, /server\\.js/);
  assert.match(builder, /paidCheckoutWebhook\\.js/);
  assert.match(builder, /PREVIEW_BUNDLE_BUILT_NOT_PRODUCTION_READY/);
});
