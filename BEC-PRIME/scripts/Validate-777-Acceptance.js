'use strict';

const fs = require('fs');
const crypto = require('crypto');

const sha = v => crypto.createHash('sha256').update(v, 'utf8').digest('hex');

function check(name, ok, detail) {
  return { name, status: ok ? 'PASS' : 'FAIL', detail };
}

function validate(run) {
  const a = run?.acceptance_contract || {};
  const checks = [];
  checks.push(check('signal_id', a.signal_id != null && a.signal_id !== '', 'signal_id required'));
  checks.push(check('observed_problem', a.observed_problem != null && a.observed_problem !== '', 'observed_problem required'));
  checks.push(check('offer_id', a.offer_id != null && a.offer_id !== '', 'offer_id required'));
  checks.push(check('price_nzd', Number(a.price_nzd) > 0, 'price_nzd must be > 0'));
  checks.push(check('payment_link', a.payment_link != null && a.payment_link !== '', 'payment_link required'));
  checks.push(check('silo_id', a.silo_id != null && a.silo_id !== '', 'silo_id required'));
  checks.push(check('lane_id', a.lane_id != null && a.lane_id !== '', 'lane_id required'));
  checks.push(check('experiment_id', a.experiment_id != null && a.experiment_id !== '', 'experiment_id required'));
  checks.push(check('telemetry_id', a.telemetry_id != null && a.telemetry_id !== '', 'telemetry_id required'));
  checks.push(check('human_gate', a.external_action === 'REVIEW_AND_APPROVE_EXTERNAL_REPLY', 'external action must be human-gated'));
  checks.push(check('not_sent', a.send_status !== 'SENT', 'must not be SENT before approval'));

  const reality = a.reality || {};
  const verified = reality.truth_status === 'VERIFIED' &&
    reality.settled_payment === true &&
    reality.fulfillment === true &&
    reality.evidence === true;

  const attribution = a.attribution || {};
  const attributionOk = attribution.offer_matches_payment === true &&
    attribution.candidate_matches_signal === true &&
    attribution.candidate_matches_silo === true;

  checks.push(check('attribution', attributionOk, 'offer/payment, candidate/signal and candidate/silo bindings required'));

  const expansion = verified && attributionOk;
  const result = {
    schema: 'DREAMLEDGER/777_ACCEPTANCE_RESULT/v1',
    verified,
    attribution_integrity: attributionOk,
    expansion_permission: expansion ? 1 : 0,
    disposition: expansion ? 'PERMIT_MECHANISM_FOSSIL' : 'HOLD_OR_KILL_NO_CLONE',
    checks,
    integrity_sha256: null
  };
  result.integrity_sha256 = sha(JSON.stringify(result));
  return result;
}

if (require.main === module) {
  const file = process.argv[2] || require('path').join(__dirname, '..', 'data', '777', '777-LATEST.json');
  const run = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(JSON.stringify(validate(run), null, 2));
}

module.exports = { validate };
