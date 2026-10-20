'use strict';

const crypto = require('node:crypto');

const TIERS = new Set(['HCC', 'AAC', 'ACC']);
const AI_MODES = new Set(['HUMAN_COMPOSED', 'AI_ASSISTED', 'AI_GENERATED']);
const URL = /^https:\/\//i;
const BOOLEAN_FIELDS = [
  'checkout_enabled',
  'inventory_verified',
  'fulfillment_contract_verified',
  'settlement_required',
  'delivery_proof_required'
];

function validateSiloCloneContract(contract) {
  const errors = [];
  const warnings = [];
  const add = (code, message) => errors.push({ code, message });
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    return {
      schema: 'DREAMLEDGER/SILO-CLONE-VALIDATION/v1',
      status: 'BLOCK',
      publish_allowed: false,
      error_count: 1,
      warning_count: 0,
      errors: [{ code: 'CONTRACT_OBJECT_REQUIRED', message: 'A silo clone contract object is required.' }],
      warnings
    };
  }

  const id = contract.silo_id;
  if (typeof id !== 'string' || !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(id)) {
    add('SILO_ID_INVALID', 'silo_id must be a lowercase URL-safe slug.');
  }

  const fee = contract.fee_policy;
  if (!fee || !Number.isInteger(fee.platform_fee_bps) || fee.platform_fee_bps < 0 || fee.platform_fee_bps > 10000) {
    add('FEE_POLICY_INVALID', 'fee_policy.platform_fee_bps must be an integer from 0 to 10000.');
  } else {
    if (fee.platform_fee_bps === 0 && fee.zero_fee_override !== true) {
      add('ZERO_FEE_OVERRIDE_REQUIRED', 'A 0% fee requires an explicit zero_fee_override=true policy.');
    }
    if (fee.zero_fee_override === true && fee.platform_fee_bps !== 0) {
      add('ZERO_FEE_OVERRIDE_CONTRADICTS_RATE', 'zero_fee_override=true is only valid with a 0-basis-point platform fee.');
    }
    if (id === 'mtg' && (fee.platform_fee_bps !== 0 || fee.zero_fee_override !== true)) {
      add('MTG_ZERO_FEE_OVERRIDE_REQUIRED', 'The MTG master silo requires an explicit permanent 0% platform-fee override.');
    }
  }

  const author = contract.authorship;
  if (!author || !TIERS.has(author.declared_tier) || !AI_MODES.has(author.production_mode)) {
    add('AUTHORSHIP_DECLARATION_REQUIRED', 'Declare authorship.declared_tier (HCC/AAC/ACC) and production_mode.');
  } else {
    const expected = { HCC: 'HUMAN_COMPOSED', AAC: 'AI_ASSISTED', ACC: 'AI_GENERATED' }[author.declared_tier];
    if (author.production_mode !== expected) {
      add('AUTHORSHIP_TIER_MISMATCH', 'Declared authorship tier does not match the recorded production mode.');
    }
    if (author.production_mode !== 'HUMAN_COMPOSED' && author.human_review_required !== true) {
      add('HUMAN_REVIEW_REQUIRED', 'AI-assisted or AI-generated content must require human review before publication.');
    }
  }

  const support = contract.support;
  if (!support || support.status === 'NOT_CONFIGURED') {
    warnings.push({ code: 'SUPPORT_DESTINATION_DORMANT', message: 'Optional support promotion stays hidden until configured and verified.' });
  } else if (support.status !== 'VERIFIED' || typeof support.url !== 'string' || !URL.test(support.url)) {
    add('SUPPORT_DESTINATION_UNVERIFIED', 'A configured support destination must be HTTPS and explicitly VERIFIED.');
  }

  const content = contract.content;
  if (!content || typeof content.canonical_record_id !== 'string' || !content.canonical_record_id.trim()) {
    add('CANONICAL_CONTENT_RECORD_REQUIRED', 'Every publishable content item needs a canonical record ID.');
  }
  if (!content || typeof content.public_cutoff !== 'string' || !content.public_cutoff.trim()) {
    add('PAYWALL_CUTOFF_REQUIRED', 'Declare the public/paid content cutoff, or explicitly use NONE.');
  }
  if (!content || typeof content.paid_content_public_distribution !== 'boolean') {
    add('PAYWALL_DISTRIBUTION_POLICY_REQUIRED', 'Explicitly declare whether paid content may enter public distribution.');
  } else if (content.paid_content_public_distribution === true) {
    add('PAYWALL_LEAK_RISK', 'Paid content cannot be sent to public distribution destinations.');
  }

  const measurement = contract.measurement;
  if (!measurement || typeof measurement.evidence_path !== 'string' || !measurement.evidence_path.trim()) {
    add('MEASUREMENT_EVIDENCE_PATH_REQUIRED', 'Declare the durable path where attribution and outcome evidence is recorded.');
  }

  const commerce = contract.commerce;
  if (!commerce || typeof commerce !== 'object' || Array.isArray(commerce)) {
    add('COMMERCE_CONTRACT_REQUIRED', 'Declare commerce state and evidence requirements even when checkout is disabled.');
  } else {
    for (const field of BOOLEAN_FIELDS) {
      if (typeof commerce[field] !== 'boolean') {
        add('COMMERCE_FIELD_REQUIRED', 'commerce.' + field + ' must be explicitly true or false.');
      }
    }
    if (commerce.checkout_enabled === true) {
      if (commerce.inventory_verified !== true) add('CHECKOUT_INVENTORY_UNVERIFIED', 'Checkout must remain disabled until inventory is verified.');
      if (commerce.fulfillment_contract_verified !== true) add('CHECKOUT_FULFILLMENT_UNVERIFIED', 'Checkout must remain disabled until fulfillment requirements are verified.');
      if (commerce.settlement_required !== true || commerce.delivery_proof_required !== true) {
        add('ECONOMIC_EVIDENCE_GATES_MISSING', 'Checkout must require settlement and delivery proof.');
      }
    }
  }

  const security = contract.security;
  const requiredSecurityControls = [
    'gauntlet_required',
    'secret_scan_required',
    'dependency_scan_required',
    'silo_isolation_required',
    'offline_first',
    'signed_release_required',
    'human_release_approval_required',
    'local_worker_inbound_disabled',
    'online_release_allowlist_only'
  ];
  if (!security || typeof security !== 'object' || Array.isArray(security)) {
    add('SECURITY_CONTRACT_REQUIRED', 'Declare Gauntlet, supply-chain, silo-isolation, offline-first and release controls.');
  } else {
    for (const field of requiredSecurityControls) {
      if (security[field] !== true) add('SECURITY_CONTROL_REQUIRED', 'security.' + field + ' must be explicitly true.');
    }
    const membrane = security.offline_online_membrane;
    if (!membrane || membrane.directionality !== 'FIGURE_EIGHT' ||
        membrane.online_to_offline !== 'QUARANTINED_INPUT_ONLY' ||
        membrane.offline_to_online !== 'SIGNED_APPROVED_ARTIFACTS_ONLY') {
      add('FIGURE_EIGHT_MEMBRANE_POLICY_REQUIRED', 'Online-to-offline inputs must be quarantined; offline-to-online outputs must be signed and explicitly approved.');
    }
  }

  const x402 = contract.x402;
  if (!x402 || typeof x402.enabled !== 'boolean') {
    add('X402_POLICY_REQUIRED', 'Declare x402.enabled explicitly; missing configuration must remain fail-closed.');
  } else if (x402.enabled === true) {
    for (const field of ['network', 'asset', 'pay_to', 'facilitator']) {
      if (typeof x402[field] !== 'string' || !x402[field].trim() || /CONFIGURE_BEFORE_LIVE|placeholder|example/i.test(x402[field])) {
        add('X402_' + field.toUpperCase() + '_INVALID', 'Enabled x402 requires a real configured ' + field + '.');
      }
    }
    if (x402.live_approved !== true) {
      add('X402_LIVE_APPROVAL_REQUIRED', 'x402 cannot be enabled for live traffic without explicit live_approved=true.');
    }
  }

  const publishAllowed = errors.length === 0;
  return {
    schema: 'DREAMLEDGER/SILO-CLONE-VALIDATION/v1',
    silo_id: typeof id === 'string' ? id : null,
    status: publishAllowed ? 'PASS' : 'BLOCK',
    publish_allowed: publishAllowed,
    error_count: errors.length,
    warning_count: warnings.length,
    errors,
    warnings
  };
}

function mergePolicy(base, override) {
  if (!base || typeof base !== 'object' || Array.isArray(base)) return override;
  const result = { ...base };
  if (!override || typeof override !== 'object' || Array.isArray(override)) return result;
  for (const [key, value] of Object.entries(override)) {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? mergePolicy(result[key] || {}, value)
      : value;
  }
  return result;
}

function buildContractForManifest(manifest, policyDefinition) {
  const id = manifest && (manifest.slug || manifest.silo_id || manifest.silo_name);
  if (typeof id !== 'string' || !id) return null;
  const defaults = policyDefinition && policyDefinition.clone_contract_defaults;
  if (!defaults || typeof defaults !== 'object') return null;
  const overrides = (policyDefinition.silo_overrides && policyDefinition.silo_overrides[id]) || {};
  const contract = mergePolicy(defaults, overrides);
  contract.silo_id = id;
  return contract;
}

function validateCloneManifest(manifest, contractOverride = null) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    const verdict = validateSiloCloneContract(null);
    verdict.errors.unshift({ code: 'CLONE_MANIFEST_OBJECT_REQUIRED', message: 'A clone manifest object is required.' });
    verdict.error_count = verdict.errors.length;
    return verdict;
  }

  const contract = contractOverride || manifest.clone_contract;
  const verdict = validateSiloCloneContract(contract);
  const add = (code, message) => verdict.errors.push({ code, message });
  const manifestId = manifest.slug || manifest.silo_id || manifest.silo_name;
  if (!contract || typeof contract !== 'object') {
    add('CLONE_POLICY_REQUIRED', 'The clone manifest must embed clone_contract; standalone checklist text is not enforceable policy.');
  } else if (typeof manifestId === 'string' && contract.silo_id !== manifestId) {
    add('SILO_ID_MISMATCH', 'Manifest identity must match clone_contract.silo_id.');
  }

  let sourceFeeBps = null;
  if (Number.isInteger(manifest.platform_success_fee_bps)) {
    sourceFeeBps = manifest.platform_success_fee_bps;
  } else if (Number.isFinite(manifest.success_fee_peer)) {
    sourceFeeBps = Math.round(manifest.success_fee_peer * 10000);
  } else if (manifest.rules && Number.isInteger(manifest.rules.platform_success_fee_bps)) {
    sourceFeeBps = manifest.rules.platform_success_fee_bps;
  }
  if (sourceFeeBps !== null && contract && contract.fee_policy && contract.fee_policy.platform_fee_bps !== sourceFeeBps) {
    add('FEE_POLICY_SOURCE_MISMATCH', 'Embedded fee policy does not match the manifest source fee field.');
  }

  verdict.errors = verdict.errors.filter(Boolean);
  verdict.error_count = verdict.errors.length;
  verdict.status = verdict.error_count === 0 ? 'PASS' : 'BLOCK';
  verdict.publish_allowed = verdict.status === 'PASS';
  return verdict;
}

function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function createSignedVerdict(payload, privateKeyPem) {
  if (!privateKeyPem) return { status: 'UNSIGNED_KEY_NOT_CONFIGURED', algorithm: 'Ed25519', signature: null, public_key: null, public_key_sha256: null };
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('DREAMLEDGER_CLONE_VERDICT_PRIVATE_KEY must be an Ed25519 private key.');
  const publicKey = crypto.createPublicKey(privateKey);
  const publicDer = publicKey.export({ type: 'spki', format: 'der' });
  const signature = crypto.sign(null, Buffer.from(stableStringify(payload)), privateKey);
  return {
    status: 'SIGNED',
    algorithm: 'Ed25519',
    signature: signature.toString('base64url'),
    public_key: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    public_key_sha256: crypto.createHash('sha256').update(publicDer).digest('hex')
  };
}

module.exports = { validateSiloCloneContract, validateCloneManifest, buildContractForManifest, stableStringify, createSignedVerdict };
