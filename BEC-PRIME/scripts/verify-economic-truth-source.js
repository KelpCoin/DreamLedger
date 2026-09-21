'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
function read(file) { return fs.readFileSync(path.resolve(repoRoot, file), 'utf8'); }
function requireText(text, marker, label) {
  if (!text.includes(marker)) throw new Error(label + ': missing ' + marker);
}

const recorder = read('supabase/migrations/20260921113100_business_truth_recorder_return_fix.sql');
const guards = read('supabase/migrations/20260921104745_economic_truth_guard_record_safe_fix.sql');
const fullChain = read('supabase/migrations/20260921120500_economic_truth_full_chain_enforcement.sql');
const webhook = read('supabase/functions/stripe-revenue-41104f355d6878cdd6d1f9dc/index.ts');

requireText(recorder, "v_truth text:='UNVERIFIED'", 'truth recorder');
requireText(recorder, "v_evidence_count", 'truth recorder');
requireText(recorder, "v_meta->>'livemode'", 'truth recorder');
for (const marker of ['external_buyer','settled_transaction','attributed','fulfilled']) {
  requireText(recorder, marker, 'truth recorder');
}
requireText(fullChain, "evidence_valid", 'full-chain guard');
requireText(fullChain, "economic_outcomes", 'full-chain guard');
requireText(fullChain, "capture_economic_fulfillment_outcome", 'fulfillment binding');
for (const marker of ['trg_economic_truth_guards_actions','trg_economic_truth_guards_cells','trg_economic_truth_guards_events']) {
  requireText(guards, marker, 'action/event/cell guard');
}
requireText(webhook, "if(event.livemode!==true)", 'Stripe test/live boundary');

const forbidden = [
  '.github/workflows/demand-radar-n8n.yml',
  'BEC-PRIME/demand-radar/n8n-community-collector.js'
];
for (const file of forbidden) {
  if (fs.existsSync(path.resolve(repoRoot, file))) throw new Error('forbidden n8n artifact remains: ' + file);
}

console.log(JSON.stringify({
  schema: 'dreamledger.economic-truth-source-verification.v2',
  status: 'PASS',
  checks: [
    'recorder_defaults_unverified',
    'verified_requires_full_chain',
    'server_side_truth_guard_present',
    'fulfillment_binding_present',
    'action_authority_guard_present',
    'test_live_webhook_boundary_present',
    'n8n_artifacts_absent'
  ]
}, null, 2));
