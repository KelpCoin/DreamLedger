'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OFFER_FILE = path.join(ROOT, 'catalog', 'offers', 'offers.json');
const APPROVED_FILE = path.join(ROOT, 'catalog', 'offers', 'approved.json');
const IP_FILE = path.join(ROOT, 'catalog', 'ip-capabilities.json');
const PROOF_DIR = path.join(ROOT, 'data', 'proofs');
const continuousCompletion = require('./ContinuousCompletionEvaluator');

function evaluateContinuousProgress(options) {
  if (!options.continuousEvaluation) {
    return {
      schema: 'DREAMLEDGER-VERDICT-RECORD/v1',
      status: 'NOT_RUN',
      typed_verdict: 'NEEDS_EVIDENCE',
      completion_score: null,
      score_domain: 'economic_event_steps_1_to_10_only',
      binary_gate_pass: false,
      verified_economic_outcome: false,
      missing_evidence: ['continuous_evaluation_input_not_supplied'],
      next_action: 'supply evidence records from trusted verifiers; do not infer economic truth from catalog checks'
    };
  }
  return {
    status: 'EVALUATED',
    ...continuousCompletion.evaluateEconomicEvent(options.continuousEvaluation, {
      verifyEvidence: options.verifyContinuousEvidence
    })
  };
}

function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function fail(checks, id, message) { checks.push({ id, status: 'FAIL', message }); }
function pass(checks, id, message) { checks.push({ id, status: 'PASS', message }); }

function run(options = {}) {
  const checks = [];
  const offerFile = options.offerFile || OFFER_FILE;
  const approvedFile = options.approvedFile || APPROVED_FILE;
  const ipFile = options.ipFile || IP_FILE;
  const offerCatalog = readJson(offerFile);
  const approvedCatalog = fs.existsSync(approvedFile) ? readJson(approvedFile) : { approved: [] };
  const approvedIds = new Set((Array.isArray(approvedCatalog.approved) ? approvedCatalog.approved : []).map(x => String(x.offer_id)));
  const offers = Array.isArray(offerCatalog.offers) ? offerCatalog.offers : [];

  if (!offers.length) fail(checks, 'offers.present', 'No canonical offers found');
  else pass(checks, 'offers.present', `${offers.length} canonical offers loaded`);

  const ids = offers.map(x => x.offer_id);
  const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicateIds.length) fail(checks, 'offers.unique', `Duplicate offer IDs: ${duplicateIds.join(', ')}`);
  else pass(checks, 'offers.unique', 'Offer IDs are unique');

  for (const offer of offers) {
    const prefix = `offer.${offer.offer_id}`;
    const explicitlyApproved = approvedIds.has(String(offer.offer_id));
    for (const field of ['offer_id', 'capability_id', 'name', 'problem', 'input', 'output', 'delivery_mechanism', 'deliverable', 'target_buyer', 'price', 'currency', 'payment_adapter', 'checkout_route', 'approval_required', 'checkout_available', 'status', 'proof_of_delivery', 'verification_rules', 'provenance']) {
      if (offer[field] === undefined || offer[field] === '') fail(checks, `${prefix}.${field}`, 'Required field missing');
    }

    const unavailableWithoutPrice = offer.price === null && offer.checkout_available === false && offer.status === 'unavailable';
    if (!(Number(offer.price) > 0) && !unavailableWithoutPrice) {
      fail(checks, `${prefix}.price`, 'Checkoutable or quarantined offers must have a positive price');
    } else if (unavailableWithoutPrice) {
      pass(checks, `${prefix}.price`, 'Unavailable offer may omit price because checkout is disabled');
    }

    if (explicitlyApproved) {
      const intentionallyHeld = offer.approval_required === true
        && offer.checkout_available === false
        && ['HELD_CANONICAL_PRODUCT_GATE', 'HELD_STRIPE_LINK_DRIFT'].includes(offer.status)
        && (offer.payment_link_url === null || offer.payment_link_url === undefined || offer.payment_link_url === '');
      if (intentionallyHeld) {
        // An operator approval record does not override the live canonical
        // product gate. A deliberately held offer is a valid, safe Gauntlet
        // state and must remain visibly non-purchasable.
        pass(checks, `${prefix}.approval`, 'Operator record exists; canonical product gate still requires approval');
        pass(checks, `${prefix}.checkout`, 'Checkout remains disabled while canonical gate is closed');
        pass(checks, `${prefix}.status`, `Explicitly held by ${offer.status}`);
      } else {
        if (offer.approval_required !== false) fail(checks, `${prefix}.approval`, 'Checkout-enabled approved offer must have approval_required=false');
        if (offer.checkout_available !== true) fail(checks, `${prefix}.checkout`, 'Checkout-enabled approved offer must have checkout enabled');
        if (offer.status !== 'VERIFIED_AVAILABLE') fail(checks, `${prefix}.status`, 'Checkout-enabled approved offer must be VERIFIED_AVAILABLE');
        pass(checks, `${prefix}.approval`, 'Explicit operator approval record present');
        pass(checks, `${prefix}.checkout`, 'Checkout enabled only for explicitly approved offer');
      }
    } else {
      if (offer.approval_required !== true) fail(checks, `${prefix}.approval`, 'Human approval gate must remain locked');
      if (offer.checkout_available !== false) fail(checks, `${prefix}.checkout`, 'Checkout must remain disabled until approval');
    }
    if (offer.provenance?.private_material !== 'excluded') fail(checks, `${prefix}.privacy`, 'Private material must remain excluded');
    if (offer.silo === 'mtg' && /amplissa|adult/i.test(JSON.stringify(offer))) fail(checks, `${prefix}.silo`, 'MTG offer contains forbidden adult/Amplissa reference');
  }

  if (fs.existsSync(ipFile)) {
    const ip = readJson(ipFile);
    const caps = Array.isArray(ip.capabilities) ? ip.capabilities : [];
    const capIds = new Set(caps.map(x => x.capability_id || x.id));
    for (const offer of offers) {
      if (!capIds.has(offer.capability_id)) fail(checks, `capability.${offer.capability_id}`, 'Offer references an unknown capability');
    }
    if (offers.every(offer => capIds.has(offer.capability_id))) pass(checks, 'capabilities.linked', 'Every offer capability resolves in the IP catalog');
  } else {
    fail(checks, 'capabilities.catalog', 'IP capability catalog is missing');
  }

  const status = checks.every(x => x.status === 'PASS') ? 'PASS' : 'FAIL';
  const continuousProgress = evaluateContinuousProgress(options);
  let continuousProgressLedger = { recorded: false, status: 'NOT_REQUESTED' };
  if (options.recordContinuousProgress === true && options.continuousEvaluation) {
    try {
      const completionLedger = require('./ContinuousCompletionLedger');
      continuousProgressLedger = completionLedger.evaluateAndRecordEconomicEvent(options.continuousEvaluation, {
        ledger: options.decisionLedger,
        verifyEvidence: options.verifyContinuousEvidence
      });
    } catch (error) {
      continuousProgressLedger = { recorded: false, status: 'HOLD_CONTINUOUS_LEDGER_ADAPTER_ERROR', error_class: error && error.name || 'Error' };
    }
  }
  const payload = {
    type: 'dreamledger-gauntlet-v6-proof',
    version: '6.0',
    status,
    checks,
    continuous_progress: continuousProgress,
    continuous_progress_ledger: continuousProgressLedger,
    economic_truth_authority: 'INDEPENDENT_SETTLEMENT_AND_FULFILLMENT_EVIDENCE_REQUIRED',
    checked_at: new Date().toISOString(),
    approved_offer_ids: Array.from(approvedIds),
    source_hash: sha256(JSON.stringify({
      offers: offerCatalog,
      approved: approvedCatalog,
      ip: fs.existsSync(ipFile) ? readJson(ipFile) : null,
      continuous_evaluation_input: options.continuousEvaluation || null
    }))
  };

  if (options.writeProof !== false) {
    fs.mkdirSync(PROOF_DIR, { recursive: true });
    fs.writeFileSync(path.join(PROOF_DIR, 'GAUNTLET-V6-LATEST.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8');
  }
  return payload;
}

module.exports = { run };
