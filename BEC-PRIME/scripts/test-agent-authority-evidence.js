'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-agent-authority-'));
process.env.BEC_LEDGER_DIR = path.join(root, 'ledger');
process.env.BEC_AUTHORITY_DIR = path.join(root, 'authority');

const ledger = require('../runtime/Ledger');
const authority = require('../runtime/AgentAuthority');
const truthOracle = require('../runtime/TruthOracle');

try {
  const accountId = 'test-account';
  const configured = authority.setCeiling(accountId, 1200000, 'NZD');
  assert.equal(configured.authority_ceiling_cents, 1200000);

  const under = authority.evaluateAgentBid(accountId, { bid_id: 'under-ceiling', amount_cents: 1190000 });
  assert.equal(under.status, 'ACCEPTED');
  assert.equal(under.economic_truth.SALE_SETTLED, false);

  const over = authority.evaluateAgentBid(accountId, { bid_id: 'over-ceiling', amount_cents: 1205000 });
  assert.equal(over.status, 'REJECTED');
  assert.equal(over.accepted, false);
  assert.equal(over.evidence.event_id, 'agent_authority_over-ceiling');
  assert.equal(over.economic_truth.ECONOMIC_PROOF, false);

  const evidence = authority.findEvidence(over.evidence.event_id);
  assert.ok(evidence);
  assert.equal(evidence.result, 'REJECTED');
  assert.equal(evidence.payload.rejection_reason, 'AUTHORITY_CEILING_EXCEEDED');
  assert.equal(evidence.payload.authority_ceiling_cents, 1200000);
  assert.equal(evidence.payload.amount_cents, 1205000);
  assert.equal(evidence.claims.sale_claim, false);

  const oracle = truthOracle.snapshot();
  assert.ok(oracle.ledger_events.some(event => event.event_id === over.evidence.event_id));
  assert.equal(oracle.agent_authority_statement, 'Agent actions that violate the authority ceiling are recorded as evidence.');
  assert.equal(oracle.chain_status, 'PASS');

  const ledgerText = fs.readFileSync(ledger.EVENTS_FILE, 'utf8');
  fs.writeFileSync(ledger.EVENTS_FILE, ledgerText.replace('1205000', '1205001'), 'utf8');
  const tampered = ledger.verifyChain();
  assert.equal(tampered.status, 'FAIL');
  assert.ok(tampered.failures.length > 0);

  console.log(JSON.stringify({
    status: 'PASS',
    authority_ceiling_nzd: 12000,
    accepted_bid_nzd: 11900,
    rejected_bid_nzd: 12050,
    rejection_event_id: over.evidence.event_id,
    rejection_event_hash: over.evidence.event_hash,
    chain_before_tamper: oracle.chain_status,
    chain_after_tamper: tampered.status,
    sale_settled: false,
    economic_proof: false,
    revenue: false
  }, null, 2));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
