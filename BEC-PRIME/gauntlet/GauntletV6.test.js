'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('./GauntletV6');

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
