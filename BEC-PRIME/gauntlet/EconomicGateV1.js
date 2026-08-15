'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OFFER_FILE = path.join(ROOT, 'catalog', 'offers', 'offers.json');
const OUT_DIR = path.join(ROOT, 'data', 'economic-gate');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function num(v, fallback) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }

function scoreOffer(offer) {
  const price = Math.max(0, num(offer.price, 0));
  const delivery = String(offer.delivery_mechanism || '').toLowerCase();
  const buyer = String(offer.target_buyer || '').toLowerCase();
  const output = String(offer.output || '').toLowerCase();
  const hasPayment = Boolean(offer.payment_adapter && offer.checkout_route);
  const digital = /digital|engine|automated|api|software/.test(delivery);
  const clearOutcome = /report|audit|diagnostic|recommend|deliverable|result|assessment/.test(output);
  const definedBuyer = buyer.length >= 20;
  const lowFrictionPrice = price > 0 && price <= 299;
  const approvalLocked = offer.approval_required === true && offer.checkout_available === false;
  const privateExcluded = offer.provenance && offer.provenance.private_material === 'excluded';

  const paymentScore = hasPayment ? 10 : 0;
  const automationScore = digital ? 10 : 3;
  const outcomeScore = clearOutcome ? 10 : 3;
  const buyerScore = definedBuyer ? 10 : 3;
  const priceScore = lowFrictionPrice ? 10 : (price > 0 ? 5 : 0);
  const deliveryScore = delivery.length >= 10 ? 10 : 3;
  const repeatScore = /diagnostic|audit|monitor|report|assessment/.test(String(offer.name || '').toLowerCase()) ? 7 : 3;
  const compoundingScore = digital && clearOutcome ? 8 : 3;
  const gateScore = approvalLocked && privateExcluded ? 10 : 0;
  const simplicityScore = (hasPayment && digital && definedBuyer) ? 10 : 3;

  const raw = paymentScore + automationScore + outcomeScore + buyerScore + priceScore +
    deliveryScore + repeatScore + compoundingScore + gateScore + simplicityScore;
  const score = clamp(raw, 0, 100);

  const expectedProbability = clamp(
    0.01 +
    (buyerScore / 10) * 0.10 +
    (outcomeScore / 10) * 0.10 +
    (paymentScore / 10) * 0.10 +
    (automationScore / 10) * 0.05,
    0,
    0.35
  );
  const expectedNetCash = Math.round(price * expectedProbability * 100) / 100;

  const blockers = [];
  if (!hasPayment) blockers.push('payment_path_incomplete');
  if (!definedBuyer) blockers.push('buyer_definition_weak');
  if (!clearOutcome) blockers.push('outcome_definition_weak');
  if (!digital) blockers.push('automation_path_weak');
  if (!approvalLocked) blockers.push('approval_gate_not_locked');
  if (!privateExcluded) blockers.push('private_material_policy_missing');

  return {
    offer_id: String(offer.offer_id),
    name: String(offer.name || ''),
    silo: String(offer.silo || ''),
    price_nzd: price,
    score,
    expected_purchase_probability: Number(expectedProbability.toFixed(4)),
    expected_net_cash_nzd: expectedNetCash,
    automation_score: automationScore,
    buyer_score: buyerScore,
    outcome_score: outcomeScore,
    payment_score: paymentScore,
    repeat_score: repeatScore,
    compounding_score: compoundingScore,
    blockers,
    recommendation: score >= 75 ? 'SURVIVE' : score >= 55 ? 'REFINE' : 'KILL'
  };
}

function run(options = {}) {
  const offerFile = options.offerFile || OFFER_FILE;
  const outDir = options.outDir || OUT_DIR;
  const catalog = readJson(offerFile);
  const offers = Array.isArray(catalog.offers) ? catalog.offers : [];
  const ranked = offers.map(scoreOffer).sort((a, b) => {
    if (b.expected_net_cash_nzd !== a.expected_net_cash_nzd) return b.expected_net_cash_nzd - a.expected_net_cash_nzd;
    return b.score - a.score;
  });

  const result = {
    schema_version: 'BEC-ECONOMIC-GATE-1.0',
    event: 'economic_gate.completed',
    status: offers.length ? 'PASS' : 'FAIL',
    objective: 'maximize_expected_net_cash_with_minimum_human_load',
    source: path.relative(ROOT, offerFile).replace(/\\/g, '/'),
    counts: {
      offers: ranked.length,
      survive: ranked.filter(x => x.recommendation === 'SURVIVE').length,
      refine: ranked.filter(x => x.recommendation === 'REFINE').length,
      kill: ranked.filter(x => x.recommendation === 'KILL').length
    },
    ranked_offers: ranked,
    source_hash: sha256(JSON.stringify(catalog)),
    checked_at_utc: new Date().toISOString()
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'ECONOMIC-GATE-LATEST.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
  return result;
}

if (require.main === module) {
  const result = run();
  console.log(JSON.stringify({
    status: result.status,
    offers: result.counts.offers,
    survive: result.counts.survive,
    refine: result.counts.refine,
    kill: result.counts.kill,
    top: result.ranked_offers.slice(0, 5)
  }, null, 2));
  process.exit(result.status === 'PASS' ? 0 : 1);
}

module.exports = { run, scoreOffer };
