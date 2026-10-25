'use strict';

const fs = require('fs');
const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function fail(checks, id, message) {
  checks.push({ id, status: 'FAIL', message });
}

function pass(checks, id, message) {
  checks.push({ id, status: 'PASS', message });
}

function run(candidate, proofPath) {
  const checks = [];
  const required = [
    'offer_id', 'name', 'problem', 'target_buyer', 'deliverable',
    'delivery_mechanism', 'price', 'currency', 'payment_adapter',
    'checkout_route', 'approval_required', 'checkout_available',
    'status', 'proof_of_delivery', 'verification_rules', 'provenance',
    'silo', 'kill_condition'
  ];

  for (const field of required) {
    if (candidate[field] === undefined || candidate[field] === null || candidate[field] === '') {
      fail(checks, `candidate.${field}`, 'Required field missing');
    } else {
      pass(checks, `candidate.${field}`, 'Present');
    }
  }

  if (Number(candidate.price) > 0) {
    pass(checks, 'candidate.price_positive', 'Paid candidate price is greater than zero');
  } else if (
    Number(candidate.price) === 0 &&
    candidate.commercial_mode === 'FREE_DISCOVERY' &&
    candidate.checkout_available === false
  ) {
    pass(checks, 'candidate.price_positive', 'Explicit free-discovery candidate has no checkout');
  } else {
    fail(checks, 'candidate.price_positive', 'Price must be greater than zero unless explicitly FREE_DISCOVERY with checkout unavailable');
  }

  if (candidate.approval_required === true) pass(checks, 'candidate.approval', 'Human approval gate is locked');
  else fail(checks, 'candidate.approval', 'Candidate must require human approval');

  if (candidate.checkout_available === false) pass(checks, 'candidate.checkout_blocked', 'Checkout remains blocked until approval');
  else fail(checks, 'candidate.checkout_blocked', 'Candidate cannot self-publish checkout');

  if (candidate.provenance?.private_material === 'excluded') pass(checks, 'candidate.privacy', 'Private material excluded');
  else fail(checks, 'candidate.privacy', 'Private material must be explicitly excluded');

  if (candidate.silo === 'mtg' && /amplissa|adult/i.test(JSON.stringify(candidate))) {
    fail(checks, 'candidate.silo_boundary', 'MTG candidate contains forbidden adult/Amplissa reference');
  } else {
    pass(checks, 'candidate.silo_boundary', 'Silo boundary clean');
  }

  if (candidate.payment_adapter && candidate.checkout_route) pass(checks, 'candidate.payment_path', 'Payment path is explicit');
  else fail(checks, 'candidate.payment_path', 'Payment adapter and checkout route are required');

  if (candidate.proof_of_delivery && candidate.verification_rules) pass(checks, 'candidate.proof', 'Proof and verification are explicit');
  else fail(checks, 'candidate.proof', 'Proof of delivery and verification rules are required');

  const status = checks.every(x => x.status === 'PASS') ? 'PASS' : 'FAIL';
  const payload = {
    type: 'dreamledger-candidate-gauntlet-proof',
    version: '1.0',
    status,
    checks,
    checked_at: new Date().toISOString(),
    candidate_hash: sha256(JSON.stringify(candidate)),
    candidate_offer_id: candidate.offer_id || null,
    public_execution: 'BLOCKED_UNTIL_HUMAN_APPROVAL'
  };

  if (proofPath) {
    fs.mkdirSync(require('path').dirname(proofPath), { recursive: true });
    fs.writeFileSync(proofPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  }
  return payload;
}

if (require.main === module) {
  const candidatePath = process.argv[2];
  const proofPath = process.argv[3];
  if (!candidatePath) {
    console.error('Usage: node CandidateGauntlet.js <candidate.json> [proof.json]');
    process.exit(2);
  }
  const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
  const result = run(candidate, proofPath);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'PASS' ? 0 : 1);
}


/*
 * Consumer-release extension to the EXISTING Gauntlet.
 * Cryptographic review receipts are not legal certification, buyer acceptance,
 * an order, a human authorization, or independently observed delivery.
 */
const REQUIRED_CONSUMER_CHECKS = Object.freeze([
  'rights_confirmed', 'claims_source_verified', 'specific_customer_value',
  'silo_isolated', 'fulfillment_end_to_end_tested', 'marketplace_policy_checked'
]);
const BLOCKING_SEVERITIES = new Set(['HIGH','CRITICAL']);
function stableJSON(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJSON).join(',') + ']';
  if (value && typeof value === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype) throw new Error('NON_PLAIN_RECEIPT');
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+stableJSON(value[k])).join(',') + '}';
  }
  if (typeof value === 'string' || typeof value === 'boolean' || value === null) return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  throw new Error('INVALID_RECEIPT_VALUE');
}
function consumerRelease(product, receipt, trustedPublicKeys = {}, now = Date.now()) {
  const failures = [];
  const productHash = sha256(JSON.stringify(product));
  function reject(code) { failures.push(code); }
  if (!product || typeof product !== 'object' || !/^[A-Za-z0-9_-]{1,120}$/.test(product.id || '')) reject('INVALID_PRODUCT_ID');
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) reject('GAUNTLET_RECEIPT_MISSING');
  else {
    if (receipt.schema !== 'BECK/CONSUMER-GAUNTLET/v1') reject('INVALID_GAUNTLET_RECEIPT_SCHEMA');
    if (receipt.verdict !== 'PASS') reject('GAUNTLET_NOT_PASS');
    if (receipt.product_id !== product.id || receipt.product_sha256 !== productHash) reject('PRODUCT_HASH_MISMATCH');
    if (!/^[a-f0-9]{64}$/.test(receipt.artifact_sha256 || '')) reject('DELIVERABLE_ARTIFACT_HASH_MISSING');
    const checked = Date.parse(receipt.checked_at || '');
    if (!Number.isFinite(checked) || checked > now + 300000 || checked < now - 7*86400000) reject('GAUNTLET_RECEIPT_STALE');
    const checks = Array.isArray(receipt.checks) ? receipt.checks : [];
    for (const id of REQUIRED_CONSUMER_CHECKS) {
      const matches = checks.filter(c => c && c.id === id);
      if (matches.length !== 1 || matches[0].status !== 'PASS' || !/^[a-f0-9]{64}$/.test(matches[0].evidence_sha256 || '')) reject('QUALITY_CHECK_MISSING_OR_FAIL:' + id);
    }
    // A warning about a genuinely blocking risk must NOT be ignored.
    if (checks.some(c => c && (c.status === 'FAIL' || BLOCKING_SEVERITIES.has(c.severity)))) reject('HIGH_OR_FAILED_GAUNTLET_FINDING');
    const key = trustedPublicKeys[receipt.issuer_id];
    if (!key || typeof receipt.signature !== 'string' || !receipt.signature) reject('TRUSTED_REVIEW_SIGNATURE_MISSING');
    else {
      try {
        const {signature, ...signed} = receipt;
        const ok = crypto.verify(null, Buffer.from(stableJSON(signed),'utf8'), key, Buffer.from(signature,'base64'));
        if (!ok) reject('BAD_REVIEW_SIGNATURE');
      } catch(_) { reject('BAD_REVIEW_SIGNATURE'); }
    }
  }
  const verdict = failures.length ? 'BLOCK' : 'PASS';
  return {
    status:verdict, failures, product_sha256:productHash,
    gauntlet_receipt_sha256:receipt ? sha256(stableJSON(receipt)) : null,
    human_approval:'SEPARATE_PREACTION_SIGNATURE_REQUIRED',
    economic_proof:'NOT_ESTABLISHED'
  };
}
// The original preaction.js gate is injected rather than cloned or weakened.
// This binds the EXACT Gauntlet receipt and product bytes in the signed action
// intent. A passing verdict still never executes a listing or spends money.
function reviewBoundPublishIntent(product, receipt, trustedPublicKeys, preaction, options={}) {
  const result = consumerRelease(product,receipt,trustedPublicKeys,options.now || Date.now());
  if (result.status !== 'PASS') return {decision:'DENY',reason:'GAUNTLET_BLOCK',failures:result.failures,executable:false};
  if (!preaction || typeof preaction.evaluate !== 'function') return {decision:'DENY',reason:'PREACTION_ADAPTER_NOT_BOUND',executable:false};
  const request = {
    silo_id:product.silo,
    job_id:options.job_id,
    action:'publish_listing',
    payload:{product_id:product.id,product_sha256:result.product_sha256,gauntlet_receipt_sha256:result.gauntlet_receipt_sha256,channel:options.channel || 'own_store'}
  };
  // request.payload MUST be present in preaction's human-signed request hash.
  return preaction.evaluate(request,options);
}

module.exports = { run, consumerRelease, reviewBoundPublishIntent, stableJSON };

