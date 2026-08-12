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

  if (Number(candidate.price) > 0) pass(checks, 'candidate.price_positive', 'Price is greater than zero');
  else fail(checks, 'candidate.price_positive', 'Price must be greater than zero');

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

module.exports = { run };
