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
  assert.ok(neon.includes("process.env.BECK_RECOVERY_ACTION || 'inspect'"));
  assert.ok(neon.includes("process.env.BECK_ALLOW_PRODUCTION_RECOVERY === 'true'"));
  assert.ok(neon.includes('if (!mutationAllowed)'));
  assert.ok(neon.includes('No POST retry was attempted.'));
  assert.ok(neon.includes('database_write_readback_verified: false'));
  assert.ok(neon.includes("const base = 'https://console.neon.tech/api/v2'"));
});

test('Cloudflare adapter defaults to inspect and allowlists deploy-hook mutations', () => {
  assert.ok(cloudflare.includes("process.env.BECK_RECOVERY_ACTION || 'inspect'"));
  assert.ok(cloudflare.includes("process.env.BECK_ALLOW_PRODUCTION_RECOVERY === 'true'"));
  assert.ok(cloudflare.includes('if (!mutationAllowed)'));
  assert.ok(cloudflare.includes('api.cloudflare.com'));
  assert.ok(cloudflare.includes('/pages/webhooks/deploy_hooks/'));
  assert.ok(cloudflare.includes('No retry.'));
});

test('Cloudflare route contract includes every money-sensitive route and stays blocked', () => {
  assert.equal(routeContract.status, 'BLOCKED_UNTIL_IMPLEMENTED_AND_PROBED');
  assert.ok(routeContract.compatibility_rule.toLowerCase().includes('static-only upload is not a valid migration'));
  const routes = routeContract.routes.map(r => r.path);
  for (const required of ['/healthz','/version','/api/products','/api/offers','/api/toll/v1/manifest','/api/webhooks/stripe','/mtg/','/silos/mtg/silo.json','/data/mtg-catalog.json']) {
    assert.ok(routes.includes(required), 'missing route ' + required);
  }
  assert.ok(routeContract.cutover_gates.some(g => g.includes('explicit approval before production DNS/domain or payment-path mutation')));
  assert.equal(routeContract.current_production_mutation, false);
  assert.equal(routeContract.verified_revenue_nzd, 0);
});

test('Cloudflare preview scaffold fails closed for dynamic routes and serves static assets through ASSETS', () => {
  assert.ok(worker.includes('BLOCKED_ROUTE_NOT_MIGRATED'));
  assert.ok(worker.includes('status: 503'));
  assert.ok(worker.includes('env.ASSETS.fetch(request)'));
  assert.ok(worker.includes('webhooks'));
  assert.ok(builder.includes('server.js'));
  assert.ok(builder.includes('paidCheckoutWebhook.js'));
  assert.ok(builder.includes('PREVIEW_BUNDLE_BUILT_NOT_PRODUCTION_READY'));
});

test('Happy Homarid Patreon and MTG public surfaces keep dated, empty-by-default market proof', () => {
  const targets = ['mtg/index.html','BEC-PRIME/website/mtg-catalog.html','BEC-PRIME/compiled/website/mtg/index.html','public/mtg/index.html'];
  for (const rel of targets) {
    const html = fs.readFileSync(path.join(root, rel), 'utf8');
    const start = html.indexOf('<section class="silo-section nz-market-board" id="nz-market-notes"');
    const end = start >= 0 ? html.indexOf('</section>', start) : -1;
    assert.ok(start >= 0 && end > start, 'missing MTG market desk section in ' + rel);
    const section = html.slice(start, end);
    for (const marker of ['Current NZ value board','No current source-verified','https://patreon.com/happyhomarid','exact printing','invalidation conditions']) {
      assert.ok(section.includes(marker), 'missing market-proof marker in ' + rel + ': ' + marker);
    }
    assert.ok(!/Amplissa|DreamMeez|BB[Ww]/i.test(section), 'silo boundary marker found in ' + rel);
    assert.equal((html.match(/id="nz-market-notes"/g)||[]).length, 1, 'duplicate market desk id in ' + rel);
  }
});
