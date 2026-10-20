'use strict';

const TIERS = new Set(['HCC', 'AAC', 'ACC']);
const AI_MODES = new Set(['HUMAN_COMPOSED', 'AI_ASSISTED', 'AI_GENERATED']);
const URL = /^https:\/\//i;

function validateSiloCloneContract(contract) {
  const errors = [];
  const warnings = [];
  const add = (code, message) => errors.push({ code, message });
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    return { schema: 'DREAMLEDGER/SILO-CLONE-VALIDATION/v1', status: 'BLOCK', publish_allowed: false, errors: [{ code: 'CONTRACT_OBJECT_REQUIRED', message: 'A silo contract object is required.' }], warnings };
  }

  const id = contract.silo_id;
  if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) add('SILO_ID_INVALID', 'silo_id must be a lowercase URL-safe slug.');
  const fee = contract.fee_policy;
  if (!fee || !Number.isInteger(fee.platform_fee_bps) || fee.platform_fee_bps < 0 || fee.platform_fee_bps > 10000) {
    add('FEE_POLICY_INVALID', 'fee_policy.platform_fee_bps must be an integer from 0 to 10000.');
  }

  const author = contract.authorship;
  if (!author || !TIERS.has(author.declared_tier) || !AI_MODES.has(author.production_mode)) {
    add('AUTHORSHIP_DECLARATION_REQUIRED', 'Declare authorship.declared_tier (HCC/AAC/ACC) and production_mode.');
  } else {
    const expected = { HCC: 'HUMAN_COMPOSED', AAC: 'AI_ASSISTED', ACC: 'AI_GENERATED' }[author.declared_tier];
    if (author.production_mode !== expected) add('AUTHORSHIP_TIER_MISMATCH', 'Declared authorship tier does not match the recorded production mode.');
    if (author.production_mode !== 'HUMAN_COMPOSED' && author.human_review_required !== true) add('HUMAN_REVIEW_REQUIRED', 'AI-assisted or AI-generated content must require human review before publication.');
  }

  const support = contract.support;
  if (!support || support.status === 'NOT_CONFIGURED') {
    warnings.push({ code: 'SUPPORT_DESTINATION_DORMANT', message: 'Optional support promotion stays hidden until configured and verified.' });
  } else if (support.status !== 'VERIFIED' || typeof support.url !== 'string' || !URL.test(support.url)) {
    add('SUPPORT_DESTINATION_UNVERIFIED', 'A configured support destination must be HTTPS and explicitly VERIFIED.');
  }

  const content = contract.content;
  if (!content || typeof content.canonical_record_id !== 'string' || !content.canonical_record_id.trim()) add('CANONICAL_CONTENT_RECORD_REQUIRED', 'Every publishable content item needs a canonical record ID.');
  if (!content || typeof content.public_cutoff !== 'string' || !content.public_cutoff.trim()) add('PAYWALL_CUTOFF_REQUIRED', 'Declare the public/paid content cutoff, or explicitly use NONE.');
  if (content && content.paid_content_public_distribution === true) add('PAYWALL_LEAK_RISK', 'Paid content cannot be sent to public distribution destinations.');

  const measurement = contract.measurement;
  if (!measurement || typeof measurement.evidence_path !== 'string' || !measurement.evidence_path.trim()) add('MEASUREMENT_EVIDENCE_PATH_REQUIRED', 'Declare where attribution and outcome evidence is recorded.');

  const commerce = contract.commerce;
  if (commerce && commerce.checkout_enabled === true) {
    if (commerce.inventory_verified !== true) add('CHECKOUT_INVENTORY_UNVERIFIED', 'Checkout must remain disabled until inventory is verified.');
    if (commerce.fulfillment_contract_verified !== true) add('CHECKOUT_FULFILLMENT_UNVERIFIED', 'Checkout must remain disabled until fulfillment requirements are verified.');
    if (commerce.settlement_required !== true || commerce.delivery_proof_required !== true) add('ECONOMIC_EVIDENCE_GATES_MISSING', 'Checkout must require settlement and delivery proof.');
  }

  const x402 = contract.x402;
  if (x402 && x402.enabled === true) {
    for (const field of ['network', 'asset', 'pay_to', 'facilitator']) {
      if (typeof x402[field] !== 'string' || !x402[field].trim() || /CONFIGURE_BEFORE_LIVE|placeholder|example/i.test(x402[field])) add('X402_' + field.toUpperCase() + '_INVALID', 'Enabled x402 requires a real configured ' + field + '.');
    }
    if (x402.live_approved !== true) add('X402_LIVE_APPROVAL_REQUIRED', 'x402 cannot be enabled for live traffic without explicit live_approved=true.');
  }

  const publishAllowed = errors.length === 0;
  return {
    schema: 'DREAMLEDGER/SILO-CLONE-VALIDATION/v1',
    silo_id: id || null,
    status: publishAllowed ? 'PASS' : 'BLOCK',
    publish_allowed: publishAllowed,
    error_count: errors.length,
    warning_count: warnings.length,
    errors,
    warnings
  };
}

module.exports = { validateSiloCloneContract };
