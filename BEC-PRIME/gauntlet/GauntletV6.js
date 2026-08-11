'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OFFER_FILE = path.join(ROOT, 'catalog', 'offers', 'offers.json');
const IP_FILE = path.join(ROOT, 'catalog', 'ip-capabilities.json');
const PROOF_DIR = path.join(ROOT, 'data', 'proofs');

function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function fail(checks, id, message) { checks.push({ id, status: 'FAIL', message }); }
function pass(checks, id, message) { checks.push({ id, status: 'PASS', message }); }

function run(options = {}) {
  const checks = [];
  const offerFile = options.offerFile || OFFER_FILE;
  const ipFile = options.ipFile || IP_FILE;
  const offerCatalog = readJson(offerFile);
  const offers = Array.isArray(offerCatalog.offers) ? offerCatalog.offers : [];

  if (!offers.length) fail(checks, 'offers.present', 'No canonical offers found');
  else pass(checks, 'offers.present', `${offers.length} canonical offers loaded`);

  const ids = offers.map(x => x.offer_id);
  const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicateIds.length) fail(checks, 'offers.unique', `Duplicate offer IDs: ${duplicateIds.join(', ')}`);
  else pass(checks, 'offers.unique', 'Offer IDs are unique');

  for (const offer of offers) {
    const prefix = `offer.${offer.offer_id}`;
    for (const field of ['offer_id', 'capability_id', 'name', 'problem', 'input', 'output', 'delivery_mechanism', 'deliverable', 'target_buyer', 'price', 'currency', 'payment_adapter', 'checkout_route', 'approval_required', 'checkout_available', 'status', 'proof_of_delivery', 'verification_rules', 'provenance']) {
      if (offer[field] === undefined || offer[field] === null || offer[field] === '') fail(checks, `${prefix}.${field}`, 'Required field missing');
    }
    if (!(Number(offer.price) > 0)) fail(checks, `${prefix}.price`, 'Price must be greater than zero');
    if (offer.approval_required !== true) fail(checks, `${prefix}.approval`, 'Human approval gate must remain locked');
    if (offer.checkout_available !== false) fail(checks, `${prefix}.checkout`, 'Checkout must remain disabled until approval');
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
  const payload = {
    type: 'dreamledger-gauntlet-v6-proof',
    version: '6.0',
    status,
    checks,
    checked_at: new Date().toISOString(),
    source_hash: sha256(JSON.stringify({ offers: offerCatalog, ip: fs.existsSync(ipFile) ? readJson(ipFile) : null }))
  };

  if (options.writeProof !== false) {
    fs.mkdirSync(PROOF_DIR, { recursive: true });
    fs.writeFileSync(path.join(PROOF_DIR, 'GAUNTLET-V6-LATEST.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8');
  }
  return payload;
}

module.exports = { run };
