'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function fingerprintDecklist(decklist) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(stable(decklist)))
    .digest('hex');
}

function cardCount(decklist) {
  if (!decklist || typeof decklist !== 'object') return 0;
  let entries = [];
  if (decklist.boards && typeof decklist.boards === 'object') {
    entries = ['commander', 'main'].flatMap((section) =>
      Array.isArray(decklist.boards[section]) ? decklist.boards[section] : []);
  } else if (Array.isArray(decklist.sections)) {
    entries = decklist.sections.flatMap((section) =>
      Array.isArray(section.cards) ? section.cards : []);
  } else if (Array.isArray(decklist.cards)) {
    entries = decklist.cards;
  }
  return entries.reduce((total, entry) => {
    if (typeof entry === 'string') return total + 1;
    const qty = Number(entry && (entry.qty ?? entry.quantity ?? 1));
    return total + (Number.isInteger(qty) && qty > 0 ? qty : 0);
  }, 0);
}

function eligibleInventoryRecords(records, requirements) {
  if (!Array.isArray(records)) return [];
  const seenKeys = new Set();
  const eligible = [];
  for (const record of records) {
    if (!record || record.inventory_status !== requirements.inventory_record_status) continue;
    if (record.physical !== true) continue;
    if (record.card_legality_status !== requirements.card_legality_status) continue;
    if (record.compatibility_status !== requirements.compatibility_status) continue;
    if (typeof record.inventory_item_id !== 'string' || !record.inventory_item_id.trim()) continue;
    if (typeof record.card_key !== 'string' || !record.card_key.trim() || seenKeys.has(record.card_key)) continue;
    if (typeof record.printing_id !== 'string' || !record.printing_id.trim()) continue;
    if (typeof record.condition !== 'string' || !record.condition.trim()) continue;
    if (typeof record.language !== 'string' || !record.language.trim()) continue;
    if (typeof record.price_nzd !== 'number' || !Number.isFinite(record.price_nzd) || record.price_nzd < 0) continue;
    if (!Number.isInteger(record.on_hand_qty) || !Number.isInteger(record.reserved_qty) ||
        record.on_hand_qty <= record.reserved_qty || record.reserved_qty < 0) continue;
    if (typeof record.evidence_ref !== 'string' || !record.evidence_ref.trim()) continue;
    seenKeys.add(record.card_key);
    eligible.push(record);
  }
  return eligible;
}

function evaluateCustomizationEligibility(input) {
  const reasons = [];
  const config = input && input.config;
  const product = input && input.product;
  const requirements = config && config.eligibility_requirements;
  const defaults = config && config.defaults;

  if (!config || !product || !requirements || !defaults) {
    return { eligible: false, reason_codes: ['REQUIRED_INPUT_MISSING'], eligible_swap_count: 0 };
  }

  const override = config.silo_overrides && config.silo_overrides[product.silo];
  const enabled = override ? override.enabled === true : defaults.enabled === true;
  if (!enabled) reasons.push('CUSTOMIZATION_DISABLED');
  if (defaults.base_offer_must_remain_available !== true) reasons.push('BASE_OFFER_MUST_REMAIN_AVAILABLE');
  if (product.status !== requirements.product_status) reasons.push('BASE_PRODUCT_NOT_PUBLISHED');
  if (!Number.isInteger(product.inventory) || product.inventory < requirements.minimum_product_inventory) {
    reasons.push('BASE_DECK_OUT_OF_STOCK');
  }
  if (product.checkout_available !== requirements.checkout_available ||
      product.purchase_path_status !== requirements.purchase_path_status) {
    reasons.push('VERIFIED_PURCHASE_PATH_REQUIRED');
  }
  if (!input.decklist || !product.decklist_url || input.decklist.id !== product.id) {
    reasons.push('PUBLISHED_DECKLIST_REQUIRED');
  }

  const actualCardCount = cardCount(input.decklist);
  if (actualCardCount !== requirements.decklist_card_count) reasons.push('DECKLIST_CARD_COUNT_INVALID');

  const proof = input.legality_proof;
  if (!proof || proof.status !== requirements.commander_legality_proof_status ||
      proof.independent_of_builder !== requirements.legality_proof_must_be_independent_of_builder ||
      !proof.verifier_id || proof.format !== 'commander' ||
      proof.card_count !== requirements.decklist_card_count ||
      proof.decklist_fingerprint !== (input.decklist ? fingerprintDecklist(input.decklist) : null)) {
    reasons.push('INDEPENDENT_CURRENT_LEGALITY_PROOF_REQUIRED');
  }

  const eligibleRecords = eligibleInventoryRecords(input.inventory_records, requirements);
  const minCount = Number(defaults.minimum_eligible_swap_cards);
  if (!Number.isInteger(minCount) || eligibleRecords.length < minCount) {
    reasons.push('VERIFIED_SWAP_POOL_BELOW_MINIMUM');
  }

  const price = override
    ? { value: override.service_fee_nzd, status: override.price_status }
    : { value: config.price && config.price.service_fee_nzd, status: config.price && config.price.status };
  if (price.status !== 'APPROVED' || typeof price.value !== 'number' ||
      !Number.isFinite(price.value) || price.value < 0) {
    reasons.push('CUSTOMIZATION_PRICE_NOT_APPROVED');
  }

  return {
    eligible: reasons.length === 0,
    reason_codes: [...new Set(reasons)],
    eligible_swap_count: eligibleRecords.length,
    required_swap_count: minCount,
    max_card_swaps: Number(defaults.max_card_swaps),
    proposed_service_fee_nzd: price.value ?? null,
    price_status: price.status || 'UNSET',
    order_time_gates: {
      requires_inventory_reservation_before_fulfilment:
        config.gates && config.gates.requires_inventory_reservation_before_fulfilment === true,
      requires_price_difference_approval_before_payment:
        config.gates && config.gates.requires_price_difference_approval_before_payment === true,
      buyer_must_confirm_final_swap_list:
        config.gates && config.gates.buyer_must_confirm_final_swap_list === true,
      reservation_expiry_must_be_rechecked_before_fulfilment:
        config.gates && config.gates.reservation_expiry_must_be_rechecked_before_fulfilment === true
    }
  };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    process.stderr.write('Usage: node evaluate-customization-eligibility.js evaluation-input.json\n');
    process.exitCode = 2;
  } else {
    try {
      const input = JSON.parse(fs.readFileSync(file, 'utf8'));
      process.stdout.write(JSON.stringify(evaluateCustomizationEligibility(input), null, 2) + '\n');
    } catch (error) {
      process.stderr.write('Eligibility evaluation failed closed: ' + error.message + '\n');
      process.exitCode = 1;
    }
  }
}

module.exports = { evaluateCustomizationEligibility, fingerprintDecklist, cardCount };
