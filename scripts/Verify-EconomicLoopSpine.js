'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const contractPath = path.join(ROOT, 'ops', 'economic', 'ECONOMIC_LOOP_CONTRACT.json');
const bridgePath = path.join(ROOT, 'PROOFS', 'cortex', 'bridge_acceptance.json');
const stripePath = path.join(ROOT, 'supabase', 'functions', 'stripe-revenue-41104f355d6878cdd6d1f9dc', 'index.ts');
const outPath = path.join(ROOT, 'proof', 'commerce', 'economic-loop-spine.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const contract = readJson(contractPath);
const bridge = readJson(bridgePath);
const stripeSource = fs.readFileSync(stripePath, 'utf8');

assert(contract.schema === 'dreamledger-economic-loop-contract-v1', 'wrong economic loop contract schema');
assert(contract.commercial_loop.join(' -> ') === 'REAL_PROBLEM -> QUALIFIED_BUYER -> OFFER -> PAYMENT -> CUSTOMER', 'commercial loop drift');
assert(contract.execution_loop.join(' -> ') === 'REAL_JOB -> AGENTS -> ONLINE_AND_LOCAL_WORKERS -> VERIFICATION -> DELIVERABLE', 'execution loop drift');
assert(contract.intersection === 'VERIFIED_VALUE', 'loop intersection drift');
assert(contract.system_boundaries.shared_evidence_layer === 'Supabase', 'shared evidence layer is not Supabase');
assert(contract.system_boundaries.payment_authority === 'Stripe', 'payment authority is not Stripe');
assert(contract.system_boundaries.agent_transport === 'AgentBridge', 'agent transport is not AgentBridge');
assert(contract.system_boundaries.online_automation === 'GitHub Actions', 'online automation is not GitHub Actions');
assert(contract.automation_policy.human_approval_required.includes('external outreach'), 'external outreach approval gate missing');
assert(contract.automation_policy.human_approval_required.includes('financial commitments'), 'financial approval gate missing');

assert(bridge.BRIDGE_PROVEN === 'YES' && bridge.status === 'PROVEN', 'AgentBridge acceptance proof is not PROVEN');
assert(bridge.acceptance_job?.final_job_status === 'completed', 'accepted bridge job is not completed');
assert(bridge.independent_verification?.independently_verified === true, 'bridge Worker B verification is not independently verified');
assert(bridge.worker_result?.payment_claim === false, 'bridge proof must not claim payment');
assert(bridge.worker_result?.sale_claim === false, 'bridge proof must not claim sale');
assert(bridge.worker_result?.fulfillment_claim === false, 'bridge proof must not claim fulfillment');

const requiredStripeMarkers = [
  'stripe_webhook_events',
  'revenue_orders',
  'revenue_entitlements',
  'fulfillment_requests',
  'event_ledger',
  'economic_events',
  'control_reconciliations',
  'session.payment_status !== "paid"',
  'amount does not match catalog price',
  'ra000001_promoted: false'
];
for (const marker of requiredStripeMarkers) {
  assert(stripeSource.includes(marker), `Stripe economic chain marker missing: ${marker}`);
}

const result = {
  schema: 'dreamledger-economic-loop-spine-proof-v1',
  status: 'GREEN_STATIC_RAILS',
  generated_at: new Date().toISOString(),
  target_weekly_nzd: contract.target_weekly_nzd,
  commercial_loop: contract.commercial_loop,
  execution_loop: contract.execution_loop,
  intersection: contract.intersection,
  online_automation: contract.system_boundaries.online_automation,
  shared_evidence_layer: contract.system_boundaries.shared_evidence_layer,
  payment_authority: contract.system_boundaries.payment_authority,
  agent_transport: contract.system_boundaries.agent_transport,
  bridge_proven: true,
  stripe_payment_gate_present: true,
  revenue_claimed_nzd: 0,
  revenue_verified: false,
  customer_validation: false,
  scope: 'Static contract and source/proof inspection only. This does not assert a live customer payment, live fulfillment, or live end-to-end production run.',
  next_connection: 'Supabase live economic state -> AgentBridge/local execution -> independent verification -> delivery evidence -> commercial reconciliation'
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
