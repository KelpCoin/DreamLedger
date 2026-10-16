'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('./GauntletV6');
const { ECONOMIC_STEPS, VERIFIER_BY_SIGNAL } = require('./ContinuousCompletionEvaluator');

const TEST_EVIDENCE_HASH = 'b'.repeat(64);

function heldOffer(id, capabilityId) {
  return {
    offer_id: id,
    capability_id: capabilityId,
    silo: 'mtg',
    name: 'Held diagnostic',
    problem: 'A diagnostic held pending proof.',
    input: 'Customer supplied decklist.',
    output: 'Draft report.',
    delivery_mechanism: 'blocked_until_fulfillment_ready',
    deliverable: 'Diagnostic report',
    target_buyer: 'Commander player',
    price: 29,
    currency: 'NZD',
    payment_adapter: 'stripe',
    checkout_route: '/mtg/',
    approval_required: true,
    checkout_available: false,
    status: 'HELD_CANONICAL_PRODUCT_GATE',
    payment_link_url: null,
    proof_of_delivery: 'settlement_plus_delivery_record',
    verification_rules: ['canonical_product', 'settlement', 'delivery'],
    provenance: { private_material: 'excluded' }
  };
}

function verifiedSignal(signal) {
  return {
    status: 'PASS',
    evidence_ref: 'proof://' + signal,
    evidence_sha256: TEST_EVIDENCE_HASH,
    verified_by: VERIFIER_BY_SIGNAL[signal]
  };
}

function firstSixEconomicSteps() {
  const result = {};
  for (const step of ECONOMIC_STEPS.slice(0, 6)) {
    for (const signal of step.signals) result[signal] = verifiedSignal(signal);
  }
  return result;
}

function fixture(root, name, value) {
  const file = path.join(root, name);
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
  return file;
}

test('operator-approved offer remains valid when canonical product gate explicitly holds it', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-gauntlet-held-'));
  try {
    const offer = {
      offer_id: 'OFFER-HELD-001',
      capability_id: 'CAP-HELD-001',
      silo: 'mtg',
      name: 'Held diagnostic',
      problem: 'A diagnostic held pending proof.',
      input: 'Customer supplied decklist.',
      output: 'Draft report.',
      delivery_mechanism: 'blocked_until_fulfillment_ready',
      deliverable: 'Diagnostic report',
      target_buyer: 'Commander player',
      price: 29,
      currency: 'NZD',
      payment_adapter: 'stripe',
      checkout_route: '/mtg/',
      approval_required: true,
      checkout_available: false,
      status: 'HELD_CANONICAL_PRODUCT_GATE',
      payment_link_url: null,
      proof_of_delivery: 'settlement_plus_delivery_record',
      verification_rules: ['canonical_product', 'settlement', 'delivery'],
      provenance: { private_material: 'excluded' }
    };
    const offerFile = fixture(root, 'offers.json', { offers: [offer] });
    const approvedFile = fixture(root, 'approved.json', { approved: [{ offer_id: offer.offer_id }] });
    const ipFile = fixture(root, 'ip.json', { capabilities: [{ capability_id: offer.capability_id }] });
    const result = run({ offerFile, approvedFile, ipFile, writeProof: false });
    assert.equal(result.status, 'PASS');
    assert.ok(result.checks.some(c => c.id === 'offer.OFFER-HELD-001.checkout' && c.status === 'PASS'));
    assert.equal(result.continuous_progress.status, 'NOT_RUN');
    assert.equal(result.continuous_progress.completion_score, null);
    assert.equal(result.continuous_progress.binary_gate_pass, false);
    assert.equal(result.continuous_progress_ledger.status, 'NOT_REQUESTED');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('held offer with a live payment URL is not accepted as a safe held state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-gauntlet-bypass-'));
  try {
    const offer = {
      offer_id: 'OFFER-HELD-002',
      capability_id: 'CAP-HELD-002',
      silo: 'mtg',
      name: 'Held diagnostic',
      problem: 'A diagnostic held pending proof.',
      input: 'Customer supplied decklist.',
      output: 'Draft report.',
      delivery_mechanism: 'blocked_until_fulfillment_ready',
      deliverable: 'Diagnostic report',
      target_buyer: 'Commander player',
      price: 29,
      currency: 'NZD',
      payment_adapter: 'stripe',
      checkout_route: '/mtg/',
      approval_required: true,
      checkout_available: false,
      status: 'HELD_CANONICAL_PRODUCT_GATE',
      payment_link_url: 'https://buy.stripe.com/example',
      proof_of_delivery: 'settlement_plus_delivery_record',
      verification_rules: ['canonical_product', 'settlement', 'delivery'],
      provenance: { private_material: 'excluded' }
    };
    const offerFile = fixture(root, 'offers.json', { offers: [offer] });
    const approvedFile = fixture(root, 'approved.json', { approved: [{ offer_id: offer.offer_id }] });
    const ipFile = fixture(root, 'ip.json', { capabilities: [{ capability_id: offer.capability_id }] });
    const result = run({ offerFile, approvedFile, ipFile, writeProof: false });
    assert.equal(result.status, 'FAIL');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});


test('catalogue PASS remains distinct from economic completion and records a continuous score', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-gauntlet-progress-'));
  try {
    const offer = heldOffer('OFFER-PROGRESS-001', 'CAP-PROGRESS-001');
    const offerFile = fixture(root, 'offers.json', { offers: [offer] });
    const approvedFile = fixture(root, 'approved.json', { approved: [{ offer_id: offer.offer_id }] });
    const ipFile = fixture(root, 'ip.json', { capabilities: [{ capability_id: offer.capability_id }] });
    const result = run({
      offerFile,
      approvedFile,
      ipFile,
      writeProof: false,
      continuousEvaluation: {
        candidateId: 'RA_000001',
        verifiedAt: '2026-10-16T08:45:00.000Z',
        signalResults: firstSixEconomicSteps()
      },
      verifyContinuousEvidence: (record, expectedVerifier) =>
        record.evidence_sha256 === TEST_EVIDENCE_HASH && record.verified_by === expectedVerifier
    });
    assert.equal(result.status, 'PASS');
    assert.equal(result.continuous_progress.status, 'EVALUATED');
    assert.equal(result.continuous_progress.completion_score, 0.6);
    assert.equal(result.continuous_progress.typed_verdict, 'NEEDS_EVIDENCE');
    assert.equal(result.continuous_progress.binary_gate_pass, false);
    assert.ok(result.continuous_progress.missing_evidence.includes('order_id_resolved'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Gauntlet quarantines asserted PASS signals when no trusted evidence verifier is supplied', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-gauntlet-untrusted-progress-'));
  try {
    const offer = heldOffer('OFFER-PROGRESS-002', 'CAP-PROGRESS-002');
    const offerFile = fixture(root, 'offers.json', { offers: [offer] });
    const approvedFile = fixture(root, 'approved.json', { approved: [{ offer_id: offer.offer_id }] });
    const ipFile = fixture(root, 'ip.json', { capabilities: [{ capability_id: offer.capability_id }] });
    const result = run({
      offerFile,
      approvedFile,
      ipFile,
      writeProof: false,
      continuousEvaluation: {
        candidateId: 'RA_000002',
        verifiedAt: '2026-10-16T08:46:00.000Z',
        signalResults: firstSixEconomicSteps()
      }
    });
    assert.equal(result.status, 'PASS');
    assert.equal(result.continuous_progress.typed_verdict, 'QUARANTINE');
    assert.equal(result.continuous_progress.binary_gate_pass, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
