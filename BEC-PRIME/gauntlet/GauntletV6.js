'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OFFER_FILE = path.join(ROOT, 'catalog', 'offers', 'offers.json');
const APPROVED_FILE = path.join(ROOT, 'catalog', 'offers', 'approved.json');
const IP_FILE = path.join(ROOT, 'catalog', 'ip-capabilities.json');
const PROOF_DIR = path.join(ROOT, 'data', 'proofs');
const PUBLIC_CONSUMER_CATALOG = path.join(ROOT, '..', 'public', 'catalog.json');
const SILO_REGISTRY = path.join(ROOT, 'catalog', 'silos', 'CUBE-SILO-REGISTRY.json');

// Reuse the private consumer-readiness audit; do not create another classifier.
// A catalogue checkout claim is NOT a completed delivery test or authorization.
const { auditConsumerCatalog } = require('../scripts/Build-CashClosureBoard');

function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function fail(checks, id, message) { checks.push({ id, status: 'FAIL', message }); }
function pass(checks, id, message) { checks.push({ id, status: 'PASS', message }); }

function consumerReleaseVerdict(audit) {
  if (!audit || !Array.isArray(audit.products) || audit.no_purchase_actions_performed !== true) {
    return { status: 'FAIL', reason: 'CONSUMER_AUDIT_MISSING_OR_INVALID', blocked: [] };
  }
  const claimed = audit.products.filter(p => p.declared_checkout === true);
  const blocked = claimed.filter(p => p.independently_sellable !== true)
    .map(p => ({ product_id: p.product_id, reason: p.verdict }));
  return {
    status: blocked.length === 0 ? 'PASS' : 'FAIL',
    declared_checkout_count: claimed.length,
    blocked_count: blocked.length,
    blocked: blocked.slice(0, 40),
    reason: blocked.length ? 'UNVERIFIED_CONSUMER_CHECKOUT_MUST_NOT_BE_PUBLISHED' : 'NO_UNVERIFIED_CONSUMER_CHECKOUT_CLAIMS'
  };
}

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
      if (offer.approval_required !== false) fail(checks, `${prefix}.approval`, 'Explicitly approved offer must have approval_required=false');
      if (offer.checkout_available !== true) fail(checks, `${prefix}.checkout`, 'Explicitly approved offer must have checkout enabled');
      if (offer.status !== 'VERIFIED_AVAILABLE') fail(checks, `${prefix}.status`, 'Explicitly approved offer must be VERIFIED_AVAILABLE');
      pass(checks, `${prefix}.approval`, 'Explicit operator approval record present');
      pass(checks, `${prefix}.checkout`, 'Checkout enabled only for explicitly approved offer');
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

  let consumerRelease = { status: 'FAIL', reason: 'CONSUMER_EVIDENCE_NOT_EVALUATED', blocked: [] };
  try {
    const publicCatalog = readJson(options.publicCatalogFile || PUBLIC_CONSUMER_CATALOG);
    const siloRegistry = readJson(options.siloRegistryFile || SILO_REGISTRY);
    const consumerAudit = auditConsumerCatalog({
      catalog: publicCatalog, registry: siloRegistry, approved: approvedCatalog
    });
    consumerRelease = consumerReleaseVerdict(consumerAudit);
    if (consumerRelease.status !== 'PASS') {
      fail(checks, 'consumer.release_truth', consumerRelease.reason +
        '; claimed=' + consumerRelease.declared_checkout_count +
        '; blocked=' + consumerRelease.blocked_count +
        '; examples=' + consumerRelease.blocked.slice(0, 6).map(x => x.product_id).join(','));
    } else {
      pass(checks, 'consumer.release_truth', 'No unverified consumer checkout claim is eligible for public release');
    }
  } catch (error) {
    fail(checks, 'consumer.release_truth', 'Consumer source/evidence unreadable: ' + String(error.message || error));
  }

  const status = checks.every(x => x.status === 'PASS') ? 'PASS' : 'FAIL';
  const payload = {
    type: 'dreamledger-gauntlet-v6-proof',
    version: '6.0',
    status,
    checks,
    checked_at: new Date().toISOString(),
    approved_offer_ids: Array.from(approvedIds),
    consumer_release: consumerRelease,
    source_hash: sha256(JSON.stringify({ offers: offerCatalog, approved: approvedCatalog, ip: fs.existsSync(ipFile) ? readJson(ipFile) : null }))
  };

  if (options.writeProof !== false) {
    fs.mkdirSync(PROOF_DIR, { recursive: true });
    fs.writeFileSync(path.join(PROOF_DIR, 'GAUNTLET-V6-LATEST.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8');
  }
  return payload;
}

module.exports = { run, consumerReleaseVerdict };
