'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

test('cloud heartbeat has read-only repository permissions and no deploy or payment authority', () => {
  const workflow = read('.github/workflows/beck-cloud-truth-heartbeat.yml');
  assert.match(workflow, /permissions:\s*\n\s+contents:\s+read/);
  assert.doesNotMatch(workflow, /contents:\s*write|RENDER_API_KEY|api\.stripe\.com|\/deploys/);
  assert.match(workflow, /SUPABASE_URL:.*https:\/\/wbwgroygjeyukkspnqiy\.supabase\.co/);
  assert.match(workflow, /SUPABASE_KEY:.*secrets\.SUPABASE_SECRET_KEY.*secrets\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(workflow, /public_actions_allowed:false/);
  assert.match(workflow, /financial_actions_allowed:false/);
  assert.match(workflow, /claimed_nzd:0/);
  assert.match(workflow, /NOT_ASSERTED_BY_HEARTBEAT/);
});

test('local Figure Eight worker does not load production payment or cloud service secrets', () => {
  const local = read('scripts/Start-BECK-FigureEight.ps1');
  assert.match(local, /LOCAL_HEARTBEAT_TOKEN/);
  assert.doesNotMatch(local, /STRIPE_SECRET_KEY|STRIPE_LIVE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|SUPABASE_SERVICE_ROLE_KEY|ENGINE_INTERNAL_API_KEY|RENDER_API_KEY|sk_live_|whsec_/i);
  assert.match(local, /No secret was generated or printed/);
  assert.match(local, /economic truth/);
});

test('public gateway forwards local heartbeat bearer only for the exact heartbeat path', () => {
  const server = read('public/server.js');
  assert.match(server, /p==='\/api\/toll\/v1\/local-heartbeat'&&req\.headers\.authorization/);
  assert.match(server, /async function proxyTollToEngine\(req,res,p\)/);
});

test('local heartbeat is short-lived, authenticated, replay-resistant, and non-economic', () => {
  const route = read('BEC-PRIME/routes/tollRoad.js');
  assert.match(route, /LOCAL_HEARTBEAT_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(route, /value\.length >= 32/);
  assert.match(route, /crypto\.timingSafeEqual/);
  assert.match(route, /heartbeat_timestamp_replayed_or_out_of_order/);
  assert.match(route, /economic_truth_unchanged:true/);
  assert.match(route, /Operational presence only\. This is not payment, fulfilment, capability-correctness, or revenue evidence\./);
});
