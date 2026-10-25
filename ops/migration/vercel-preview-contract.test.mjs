import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const cfg=JSON.parse(fs.readFileSync('vercel.json','utf8'));

test('migration preview builds a standalone immutable static bundle',()=>{
 assert.equal(cfg.git?.deploymentEnabled,false,'migration preview must not auto-promote');
 assert.equal(cfg.outputDirectory,'ops/migration/cloudflare-preview/dist');
 assert.equal(cfg.buildCommand,'node ops/migration/cloudflare-preview/build-preview.mjs');
 assert.ok(!/render|supabase/i.test(JSON.stringify(cfg)),'old platform reference in deployment configuration');
 assert.ok(!/^https?:\/\//.test(cfg.outputDirectory));
});
test('unported payment and API requests fail closed before filesystem',()=>{
 assert.ok(Array.isArray(cfg.routes));
 const firstFilesystem=cfg.routes.findIndex(r=>r.handle==='filesystem');
 assert.ok(firstFilesystem>=2,'filesystem routing must follow blocked API/payment routes');
 function blocked(path) {
  return cfg.routes.slice(0,firstFilesystem).some(r=>r.status===503&&new RegExp(r.src).test(path));
 }
 for(const path of ['/api/stripe-link','/api/billboard-checkout','/api/billboard-webhook','/api/offer-checkout/create','/api/agent-bridge/health','/healthz','/stripe-webhook','/webhook']) assert.ok(blocked(path),'must 503 during migration: '+path);
 for(const path of ['/','/mtg/','/catalog.json','/404.html']) assert.ok(!blocked(path),'public read-only page should remain routable: '+path);
});
test('no unsafe legacy fallback, no unverified production-ready health',()=>{
 const routes=cfg.routes;
 assert.equal(routes.at(-1)?.status,404);
 assert.ok(!routes.some(r=>typeof r.dest==='string'&&/render\.com|supabase\.co/i.test(r.dest)));
 assert.ok(!routes.some(r=>r.status===200&&new RegExp(r.src).test('/healthz')));
});
