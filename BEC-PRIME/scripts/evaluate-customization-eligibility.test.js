'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { evaluateCustomizationEligibility, fingerprintDecklist } = require('./evaluate-customization-eligibility.js');
const template = require('../../config/offer-customization-defaults.json');

function fixture() {
  const config = structuredClone(template);
  config.defaults.enabled = true;
  config.silo_overrides.mtg.enabled = true;
  config.silo_overrides.mtg.status = 'APPROVED';
  config.silo_overrides.mtg.price_status = 'APPROVED';
  config.silo_overrides.mtg.service_fee_nzd = 19;

  const product = {
    id: 'EDH_TEST_0001',
    silo: 'mtg',
    status: 'published',
    inventory: 1,
    checkout_available: true,
    purchase_path_status: 'VERIFIED',
    decklist_url: '/data/decklists/test.json'
  };
  const decklist = {
    id: product.id,
    commander: 'Test Commander',
    format: 'commander',
    boards: {
      commander: ['Test Commander'],
      main: Array.from({ length: 99 }, (_, i) => 'Test Card ' + i)
    }
  };
  const inventory_records = Array.from({ length: 20 }, (_, i) => ({
    inventory_item_id: 'stock-' + i,
    card_key: 'card-' + i + '|printing-A',
    card_name: 'Stock Card ' + i,
    physical: true,
    inventory_status: 'VERIFIED',
    card_legality_status: 'VERIFIED',
    compatibility_status: 'VERIFIED',
    printing_id: 'printing-A',
    condition: 'NM',
    language: 'English',
    price_nzd: 1 + i,
    on_hand_qty: 1,
    reserved_qty: 0,
    evidence_ref: 'inventory-proof-' + i
  }));
  const legality_proof = {
    status: 'VERIFIED',
    independent_of_builder: true,
    verifier_id: 'independent-commander-legality-check',
    format: 'commander',
    card_count: 100,
    decklist_fingerprint: fingerprintDecklist(decklist)
  };
  return { config, product, decklist, inventory_records, legality_proof };
}

test('valid offer with verified deck, purchase path, legal proof and 20 in-stock choices qualifies', () => {
  const result = evaluateCustomizationEligibility(fixture());
  assert.equal(result.eligible, true);
  assert.deepEqual(result.reason_codes, []);
  assert.equal(result.eligible_swap_count, 20);
  assert.equal(result.proposed_service_fee_nzd, 19);
  assert.equal(result.order_time_gates.requires_inventory_reservation_before_fulfilment, true);
  assert.equal(result.order_time_gates.requires_price_difference_approval_before_payment, true);
});

test('existing published catalogue entry cannot qualify when checkout and purchase verification are absent', () => {
  const input = fixture();
  input.product.checkout_available = false;
  delete input.product.purchase_path_status;
  const result = evaluateCustomizationEligibility(input);
  assert.equal(result.eligible, false);
  assert.ok(result.reason_codes.includes('VERIFIED_PURCHASE_PATH_REQUIRED'));
});

test('fewer than 20 eligible unique stock records blocks the upgrade', () => {
  const input = fixture();
  input.inventory_records = input.inventory_records.slice(0, 19);
  const result = evaluateCustomizationEligibility(input);
  assert.equal(result.eligible, false);
  assert.ok(result.reason_codes.includes('VERIFIED_SWAP_POOL_BELOW_MINIMUM'));
});

test('reserved, unverified, incomplete and duplicate stock does not inflate eligibility', () => {
  const input = fixture();
  input.inventory_records[0].reserved_qty = 1;
  input.inventory_records[1].inventory_status = 'UNVERIFIED';
  input.inventory_records[2].printing_id = '';
  input.inventory_records[3].card_key = input.inventory_records[4].card_key;
  const result = evaluateCustomizationEligibility(input);
  assert.equal(result.eligible, false);
  assert.equal(result.eligible_swap_count, 16);
});

test('stale legality proof is rejected when decklist changes', () => {
  const input = fixture();
  input.decklist.boards.main[0] = 'Different Card';
  const result = evaluateCustomizationEligibility(input);
  assert.equal(result.eligible, false);
  assert.ok(result.reason_codes.includes('INDEPENDENT_CURRENT_LEGALITY_PROOF_REQUIRED'));
});

test('price and inventory gates are independent and price must be approved before the CTA appears', () => {
  const input = fixture();
  input.config.silo_overrides.mtg.price_status = 'PROPOSED_NOT_VALIDATED';
  const result = evaluateCustomizationEligibility(input);
  assert.equal(result.eligible, false);
  assert.ok(result.reason_codes.includes('CUSTOMIZATION_PRICE_NOT_APPROVED'));
  assert.equal(result.order_time_gates.requires_inventory_reservation_before_fulfilment, true);
  assert.equal(result.order_time_gates.requires_price_difference_approval_before_payment, true);
});

test('base purchase remains available independently of customization state', () => {
  const input = fixture();
  input.config.silo_overrides.mtg.enabled = false;
  const result = evaluateCustomizationEligibility(input);
  assert.equal(result.eligible, false);
  assert.ok(result.reason_codes.includes('CUSTOMIZATION_DISABLED'));
  assert.equal(input.config.defaults.base_offer_must_remain_available, true);
});

test('a different commander or illegal deck format blocks the upgrade', () => {
  const commanderMismatch = fixture();
  commanderMismatch.product.commander = 'Product Commander';
  const resultA = evaluateCustomizationEligibility(commanderMismatch);
  assert.ok(resultA.reason_codes.includes('DECKLIST_COMMANDER_MISMATCH'));

  const formatMismatch = fixture();
  formatMismatch.decklist.format = 'modern';
  formatMismatch.legality_proof.decklist_fingerprint = fingerprintDecklist(formatMismatch.decklist);
  const resultB = evaluateCustomizationEligibility(formatMismatch);
  assert.ok(resultB.reason_codes.includes('DECKLIST_FORMAT_INVALID'));
});

test('duplicate inventory item IDs cannot count as separate physical cards', () => {
  const input = fixture();
  input.inventory_records[1].inventory_item_id = input.inventory_records[0].inventory_item_id;
  const result = evaluateCustomizationEligibility(input);
  assert.equal(result.eligible, false);
  assert.equal(result.eligible_swap_count, 19);
  assert.ok(result.reason_codes.includes('VERIFIED_SWAP_POOL_BELOW_MINIMUM'));
});

test('the current real MTG catalogue does not expose a customization upsell prematurely', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/data/mtg-catalog.json'), 'utf8'));
  const product = catalog.products.find((item) => item.id === 'EDH_QUINTORIUS_0002');
  assert.ok(product, 'Expected canonical pilot deck remains in catalogue');
  const result = evaluateCustomizationEligibility({
    config: template,
    product,
    decklist: null,
    inventory_records: [],
    legality_proof: null
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reason_codes.includes('CUSTOMIZATION_DISABLED'));
  assert.ok(result.reason_codes.includes('VERIFIED_PURCHASE_PATH_REQUIRED'));
  assert.ok(result.reason_codes.includes('VERIFIED_SWAP_POOL_BELOW_MINIMUM'));
});
