import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const neon=fs.readFileSync(path.join(root,'ops/recovery/neon-endpoint.mjs'),'utf8');
const cloudflare=fs.readFileSync(path.join(root,'ops/recovery/cloudflare-pages.mjs'),'utf8');
const routeContract=JSON.parse(fs.readFileSync(path.join(root,'ops/migration/CLOUDFLARE-ROUTE-PARITY-CONTRACT.json'),'utf8'));
const worker=fs.readFileSync(path.join(root,'ops/migration/cloudflare-preview/_worker.js'),'utf8');
const builder=fs.readFileSync(path.join(root,'ops/migration/cloudflare-preview/build-preview.mjs'),'utf8');
const smoke=fs.readFileSync(path.join(root,'ops/migration/cloudflare-preview/smoke-preview.mjs'),'utf8');
const notFound=fs.readFileSync(path.join(root,'public/404.html'),'utf8');

test('Neon adapter defaults to inspect and gates mutation',()=>{
 assert.ok(neon.includes("process.env.BECK_RECOVERY_ACTION || 'inspect'"));
 assert.ok(neon.includes("process.env.BECK_ALLOW_PRODUCTION_RECOVERY === 'true'"));
 assert.ok(neon.includes('if (!mutationAllowed)'));
 assert.ok(neon.includes('No POST retry was attempted.'));
 assert.ok(neon.includes('database_write_readback_verified: false'));
 assert.ok(neon.includes("const base = 'https://console.neon.tech/api/v2'"));
});
test('Cloudflare adapter defaults to inspect and allowlists deploy-hook mutations',()=>{
 assert.ok(cloudflare.includes("process.env.BECK_RECOVERY_ACTION || 'inspect'"));
 assert.ok(cloudflare.includes("process.env.BECK_ALLOW_PRODUCTION_RECOVERY === 'true'"));
 assert.ok(cloudflare.includes('if (!mutationAllowed)'));
 assert.ok(cloudflare.includes('api.cloudflare.com'));
 assert.ok(cloudflare.includes('/pages/webhooks/deploy_hooks/'));
 assert.ok(cloudflare.includes('No retry.'));
});
test('route contract covers required routes and keeps cutover blocked',()=>{
 assert.equal(routeContract.status,'PARTIAL_READ_ONLY_RUNTIME_IMPLEMENTED_DYNAMIC_COMMERCE_BLOCKED');
 const paths=routeContract.routes.map(r=>r.path);
 for(const p of ['/healthz','/version','/api/products','/api/offers','/api/toll/v1/manifest','/api/webhooks/stripe','/mtg/','/silos/mtg/silo.json','/data/mtg-catalog.json','/404.html','/__preview-unique-not-found-probe__.html'])assert.ok(paths.includes(p),'missing route '+p);
 assert.ok(routeContract.cutover_gates.some(g=>g.includes('explicit approval before production DNS/domain or payment-path mutation')));
 assert.ok(routeContract.cutover_gates.some(g=>g.includes('each product with status=published')));
 assert.ok(routeContract.cutover_gates.some(g=>g.includes('actual HTTP 404')));
 assert.equal(routeContract.current_production_mutation,false);
 assert.equal(routeContract.verified_revenue_nzd,0);
});
test('Worker reports degraded liveness and never claims readiness',async()=>{
 const mod=await import('data:text/javascript;base64,'+Buffer.from(worker).toString('base64'));
 const fixtureSha='0123456789abcdef0123456789abcdef01234567';
 const env={CF_PAGES_COMMIT_SHA:fixtureSha,CF_PAGES_BRANCH:'preview',ASSETS:{fetch:async req=>
   new URL(req.url).pathname==='/migration-preview-release.json'
     ? new Response(JSON.stringify({schema:'dreamledger/cloudflare-preview-release/v1',commit_sha:fixtureSha,production_ready:false}),{status:200,headers:{'content-type':'application/json'}})
     : new Response('{}',{status:200})}};

 const r=await mod.default.fetch(new Request('https://preview.pages.dev/healthz'),env);
 assert.equal(r.status,200);
 const b=await r.json();
 assert.equal(b.status,'DEGRADED_STATIC_PREVIEW');
 assert.equal(b.ready,false);
 assert.equal(b.production_ready,false);
 const v=await mod.default.fetch(new Request('https://preview.pages.dev/version'),env);
 assert.equal(v.status,200);
 assert.equal((await v.json()).commit_sha,fixtureSha);
 const wrongEnv={...env,CF_PAGES_COMMIT_SHA:'fedcba9876543210fedcba9876543210fedcba98'};
 const mismatch=await mod.default.fetch(new Request('https://preview.pages.dev/version'),wrongEnv);
 assert.equal(mismatch.status,503);
 assert.equal((await mismatch.json()).status,'BLOCKED_RELEASE_IDENTITY');
});
test('Worker exposes only published catalogue records through read-only APIs',async()=>{
 const mod=await import('data:text/javascript;base64,'+Buffer.from(worker).toString('base64'));
 const fixture={products:[{id:'pub',status:'published'},{id:'held',status:'held'},{id:'draft',status:'draft'}]};
 const env={ASSETS:{fetch:async req=>new URL(req.url).pathname==='/catalog.json'
   ?new Response(JSON.stringify(fixture),{status:200,headers:{'content-type':'application/json'}})
   :new Response('asset',{status:200})}};
 const a=await mod.default.fetch(new Request('https://preview.pages.dev/api/products'),env);
 assert.equal(a.status,200);
 const ab=await a.json();
 assert.equal(ab.schema,'dreamledger/products/v1');
 assert.deepEqual(ab.products.map(x=>x.id),['pub']);
 const b=await mod.default.fetch(new Request('https://preview.pages.dev/api/offers'),env);
 assert.equal(b.status,200);
 const bb=await b.json();
 assert.equal(bb.schema,'dreamledger/offers/v1');
 assert.deepEqual(bb.offers.map(x=>x.id),['pub']);
 assert.equal((await mod.default.fetch(new Request('https://preview.pages.dev/api/products',{method:'POST'}),env)).status,405);
});
test('Stateful commerce, toll and webhooks remain fail-closed',async()=>{
 const mod=await import('data:text/javascript;base64,'+Buffer.from(worker).toString('base64'));
 const env={ASSETS:{fetch:async()=>new Response('{}',{status:200})}};
 for(const p of ['/api/toll/v1/manifest','/toll/probe','/api/commercial/status','/api/webhooks/stripe','/api/not-yet-ported']){
  const r=await mod.default.fetch(new Request('https://preview.pages.dev'+p),env);
  assert.equal(r.status,503,p);
  assert.equal((await r.json()).status,'BLOCKED_ROUTE_NOT_MIGRATED');
 }
});
test('Preview builder excludes sensitive Node runtime files',()=>{
 assert.ok(builder.includes('server.js'));
 assert.ok(builder.includes('paidCheckoutWebhook.js'));
 assert.ok(builder.includes('PREVIEW_BUNDLE_BUILT_NOT_PRODUCTION_READY'));
 assert.ok(worker.includes('env.ASSETS.fetch(request)'));
});
test('MTG surfaces keep dated empty-by-default proof board and Happy Homarid CTA',()=>{
 for(const rel of ['mtg/index.html','BEC-PRIME/website/mtg-catalog.html','BEC-PRIME/compiled/website/mtg/index.html','public/mtg/index.html']){
  const html=fs.readFileSync(path.join(root,rel),'utf8');
  const i=html.indexOf('<section class="silo-section nz-market-board" id="nz-market-notes"');
  const e=i>=0?html.indexOf('</section>',i):-1;
  assert.ok(i>=0&&e>i,'missing board '+rel);
  const s=html.slice(i,e);
  for(const marker of ['Current NZ value board','No current source-verified','https://patreon.com/happyhomarid','exact printing','invalidation conditions'])assert.ok(s.includes(marker),rel+':'+marker);
  assert.ok(!/Amplissa|DreamMeez|BB[Ww]/i.test(s));
  assert.equal((html.match(/id="nz-market-notes"/g)||[]).length,1);
 }
});

test('free exit checklist cannot claim cutover before every gate has evidence',()=>{
 const checklist=JSON.parse(fs.readFileSync(path.join(root,'ops/migration/FREE-EXIT-CHECKLIST.json'),'utf8'));
 assert.equal(checklist.schema,'dreamledger/free-provider-exit/v1');
 assert.equal(checklist.status,'NOT_RUN');
 assert.equal(checklist.terminal_acceptance.status,'BLOCKED_UNTIL_ALL_REQUIRED_GATES_PASS');
 assert.equal(checklist.terminal_acceptance.dns_cutover_authorized,false);
 assert.equal(checklist.terminal_acceptance.production_deployment_authorized,false);
 assert.equal(checklist.terminal_acceptance.revenue_verified_nzd,0);
 assert.deepEqual(checklist.gates.map(g=>g.id),checklist.terminal_acceptance.required_pass_gates);
 assert.ok(checklist.gates.every(g=>g.status==='NOT_RUN'));
 assert.ok(checklist.gates.find(g=>g.id==='G14').human_action_required);
 assert.ok(checklist.gates.find(g=>g.id==='G16').human_action_required);
 assert.ok(checklist.gates.find(g=>g.id==='G05').blocks.some(b=>b.includes('not a durable substitute')));
 assert.equal(checklist.cost_policy.free_tier_constraints.workers_requests_per_day,100000);
 assert.equal(checklist.cost_policy.free_tier_constraints.workers_cpu_ms_per_invocation,10);
});
test('preview bundle and route smoke require root 404, all published MTG detail routes, and claim actions',()=>{
 assert.ok(notFound.includes('Page not found'));
 assert.ok(builder.includes('ROOT_404_REQUIRED'));
 assert.ok(builder.includes('root_404_present:true'));
 assert.ok(smoke.includes('status: 404'));
 assert.ok(smoke.includes('genuine_404:'));
 assert.ok(smoke.includes('MTG detail:'));
 assert.ok(smoke.includes('MTG claim action:'));
 assert.ok(smoke.includes("p.status === 'published'"));
 assert.ok(smoke.includes("b.commit_sha === expectedSha"));
});

test('migration gates inventory all schemas and enforce atomic idempotent fulfillment',()=>{
 const checklist=JSON.parse(fs.readFileSync(path.join(root,'ops/migration/FREE-EXIT-CHECKLIST.json'),'utf8'));
 assert.equal(checklist.database_dump_scope_status,'NOT_SELECTED_PENDING_G02_DEPENDENCY_INVENTORY');
 const g02=checklist.gates.find(g=>g.id==='G02');
 assert.ok(g02.pass_evidence.some(x=>x.includes('all-schema inventory')));
 assert.ok(g02.pass_evidence.some(x=>x.includes('auth, storage and realtime')));
 const g05=checklist.gates.find(g=>g.id==='G05');
 assert.ok(g05.pass_evidence.some(x=>x.includes('durable outbox')));
 assert.ok(g05.pass_evidence.some(x=>x.includes('uncertain failure')));
 const g08=checklist.gates.find(g=>g.id==='G08');
 assert.ok(g08.pass_evidence.some(x=>x.includes('every product with status=published')));
 assert.ok(g08.pass_evidence.some(x=>x.includes('actual HTTP 404')));
});

test('Cloudflare preview probe is scoped to pages.dev and asserts deployment SHA',()=>{
 const smoke=fs.readFileSync(path.join(root,'ops/migration/cloudflare-preview/smoke-preview.mjs'),'utf8');
 assert.ok(smoke.includes("u.protocol !== 'https:' || !u.hostname.endsWith('.pages.dev')"));
 assert.ok(smoke.includes("b.commit_sha === expectedSha"));
 assert.ok(smoke.includes("status === 'BLOCKED_ROUTE_NOT_MIGRATED'"));
 assert.ok(smoke.includes("production_ready: false"));
 assert.ok(smoke.includes("dns_changed: false"));
});
