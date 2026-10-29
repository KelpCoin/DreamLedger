'use strict';
// BECK evidence gate: absent independent evidence is HOLD, never a synthetic PASS.
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const requirements = [
  'phase1.concurrent_last_unit',
  'phase1.transactional_inbox_rollback',
  'phase1.stripe_raw_body_signature',
  'phase1.duplicate_stripe_event',
  'phase1.out_of_order_event',
  'phase1.expired_reservation',
  'phase1.paid_fulfilled_reconciled',
  'phase2.runtime_role_nosuper_nobypass',
  'phase2.force_rls_with_check',
  'phase2.two_tenant_canary_crud_view',
  'phase2.security_invoker_metadata',
  'phase2.index_policy_validation',
  'phase2.original_tenant_regression',
  'phase2.second_tenant_independence',
  'phase2.outbox_crash_lease',
  'phase2.duplicate_outbox_effect'
];
const file = process.env.BECK_GATE_EVIDENCE_FILE || '';
let evidence = {};
if (file && fs.existsSync(file)) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (raw && raw.schema === 'beck/release-evidence/v1' && Array.isArray(raw.tests)) {
    for (const t of raw.tests) {
      if (t && typeof t.id === 'string' && t.result === 'PASS' &&
          typeof t.artifact_sha256 === 'string' && /^[a-f0-9]{64}$/.test(t.artifact_sha256) &&
          typeof t.source_ref === 'string' && t.source_ref.length > 6 &&
          typeof t.observed_at === 'string' && !Number.isNaN(Date.parse(t.observed_at))) {
        evidence[t.id] = t;
      }
    }
  }
}
const missing = requirements.filter(id=>!evidence[id]);
const report = {
  schema: 'beck/release-gate-report/v1',
  checked_at: new Date().toISOString(),
  scope: 'Happy Homarid master, phases 1 and 2',
  tests_required: requirements.length,
  evidence_supplied: requirements.length - missing.length,
  missing,
  phase1: missing.some(x=>x.startsWith('phase1.')) ? 'HOLD' : 'EVIDENCE_PRESENT_REVIEW_REQUIRED',
  phase2: missing.some(x=>x.startsWith('phase2.')) ? 'HOLD' : 'EVIDENCE_PRESENT_REVIEW_REQUIRED',
  clone_gate: 'HOLD',
  note: 'Metadata is not test execution. Human review and independent production transaction reconciliation remain mandatory.'
};
const output = JSON.stringify(report,null,2)+'\n';
const destination = process.env.BECK_GATE_PROOF_PATH || path.join(root,'beck-gate-proof.json');
fs.writeFileSync(destination, output);
process.stdout.write(output);
if (missing.length) process.exitCode = 1;
