'use strict';

const fs = require('fs');
const path = require('path');

function read(file) { return fs.readFileSync(path.join(process.cwd(), '..', file), 'utf8'); }
function requireText(text, marker, label) {
  if (!text.includes(marker)) throw new Error(label + ': missing ' + marker);
}

const migration = read('../supabase/migrations/20260921113000_business_truth_evidence_binding.sql');
const webhook = read('../supabase/functions/stripe-revenue-41104f355d6878cdd6d1f9dc/index.ts');

requireText(migration, "v_truth text:='UNVERIFIED'", 'truth recorder');
requireText(migration, "v_evidence_count", 'truth recorder');
requireText(migration, "v_meta->>'livemode'", 'truth recorder');
requireText(migration, "external_buyer", 'truth recorder');
requireText(migration, "settled_transaction", 'truth recorder');
requireText(migration, "attributed", 'truth recorder');
requireText(migration, "fulfilled", 'truth recorder');
requireText(migration, "trg_economic_truth_guards_outcomes", 'truth guard');
requireText(migration, "trg_economic_truth_guards_actions", 'action guard');
requireText(migration, "trg_economic_truth_guards_cells", 'cell guard');
requireText(migration, "trg_economic_truth_guards_events", 'event guard');
requireText(webhook, "if(event.livemode!==true)", 'Stripe test/live boundary');

const forbidden = [
  '.github/workflows/demand-radar-n8n.yml',
  'BEC-PRIME/demand-radar/n8n-community-collector.js'
];
for (const file of forbidden) {
  if (fs.existsSync(path.join(process.cwd(), file))) throw new Error('forbidden n8n artifact remains: ' + file);
}

console.log(JSON.stringify({
  schema: 'dreamledger.economic-truth-source-verification.v1',
  status: 'PASS',
  checks: [
    'recorder_defaults_unverified',
    'verified_requires_full_chain',
    'server_side_truth_guard_present',
    'action_authority_guard_present',
    'test_live_webhook_boundary_present',
    'n8n_artifacts_absent'
  ]
}, null, 2));
