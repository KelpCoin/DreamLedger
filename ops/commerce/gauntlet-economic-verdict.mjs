#!/usr/bin/env node
'use strict';

// Gauntlet is deliberately evidence-gated. This is a commercial viability gate,
// not a promise of wealth and not a substitute for an actual customer transaction.
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = p => {
  try { return JSON.parse(fs.readFileSync(path.join(root, p), 'utf8').replace(/^\uFEFF/, '')); }
  catch { return null; }
};
const scout = read('proof/commerce/latest-monetization-scout.json');
const stripe = read('proof/commerce/latest-first-dollar-stripe-reconciliation.json');
const bootstrap = read('proof/commerce/latest-economic-validation.json');
const checks = Array.isArray(bootstrap?.checks) ? bootstrap.checks : [];
const runStartedAt = Date.parse(bootstrap?.run_started_at_utc || '');
const isFresh = evidence => {
  const timestamp = Date.parse(evidence?.generated_at_utc || evidence?.generated_at || '');
  return Number.isFinite(runStartedAt) && Number.isFinite(timestamp) && timestamp >= runStartedAt;
};
const freshScout = isFresh(scout);
const freshStripe = isFresh(stripe);
const check = name => checks.find(x => x.name === name);
const status = name => check(name)?.status || 'UNVERIFIED';
const funnel = freshStripe ? stripe?.live_stripe?.offer_checkout_funnel : null;
const paid = freshStripe && Array.isArray(stripe?.live_stripe?.exact_paid_live_sessions) ? stripe.live_stripe.exact_paid_live_sessions : [];
const paidSignal = paid.length > 0;
const attributablePaidOrder = paidSignal && status('commerce.independent_paid_order') === 'PASS';
const repeatableAcquisition = status('acquisition.repeatable_demand') === 'PASS';
const positiveUnitEconomics = status('economics.positive_unit_economics') === 'PASS';
const activeLink = freshStripe && stripe?.offer?.checkout_enabled === true && stripe?.live_stripe?.exact_payment_link_found === true && stripe?.live_stripe?.payment_link_active === true;
const checkoutStarts = Number(funnel?.sessions_started_for_exact_payment_link || 0);
const openSessions = Number(funnel?.open_sessions || 0);
const expiredSessions = Number(funnel?.expired_sessions || 0);
const fulfillmentProven = status('fulfillment.end_to_end') === 'PASS';
const deliveryEvidence = status('fulfillment.delivery_evidence') === 'PASS';
const parity = status('commercial.truth_oracle_offer_parity') === 'PASS' && status('offer.retired_offer_retirement') === 'PASS';
const offer = freshScout && scout?.recommended_first_dollar_path?.offer === 'TRUTH-ORACLE-ACCESS-001';
const blockers = [];
const laws = [];
const addLaw = (id, title, pass, detail, points) => {
  laws.push({id, title, verdict: pass ? 'PASS' : 'FAIL_OR_UNPROVEN', points_awarded: pass ? points : 0, points_available: points, detail});
};
addLaw('C1', 'Specific buyer problem and bounded deliverable', offer, offer ? 'Truth Oracle Access is the bounded evidence-review workflow; checkout remains held until paid delivery proof passes.' : 'The existing scout did not establish the Truth Oracle Access as the first-dollar candidate.', 10);
addLaw('C2', 'Truth Oracle catalog and retirement contract', parity, 'The retired Stripe product/link/price must be inactive; public Truth Oracle must be canonical and paid checkout must remain held until delivery proof passes.', 10);
addLaw('C3', 'Exact live payment link is active', activeLink, stripe ? (activeLink ? 'Fresh exact Stripe link found and active.' : 'Fresh live Stripe proof missing, stale, or link absent/inactive.') : 'Live Stripe proof is missing.', 10);
addLaw('C4', 'Independent, attributable paid order', attributablePaidOrder, attributablePaidOrder ? paid.length + ' matching paid live session(s) observed and the independent-order evidence check passed; refund/dispute and payout reconciliation remain separate.' : paidSignal ? 'A matching paid live session exists, but independent buyer/order attribution is not proven by a passing evidence check.' : 'No fresh matching paid live NZ$9 Truth Oracle session has been evidenced by this run.', 20);
addLaw('C5', 'Fulfillment works end-to-end', fulfillmentProven, 'A checkout session cannot prove intake, report production, or successful fulfillment.', 15);
addLaw('C6', 'Delivery evidence exists', deliveryEvidence, 'Require a stable deliverable reference/hash and delivery timestamp/evidence.', 10);
addLaw('C7', 'Repeatable acquisition demand is measured', repeatableAcquisition, repeatableAcquisition ? 'The bootstrap contains a passing repeatable-demand evidence check.' : checkoutStarts ? checkoutStarts + ' live checkout session(s) observed (' + openSessions + ' open, ' + expiredSessions + ' expired); visitors, unique buyers, traffic source and acquisition cost are not established.' : 'No verified traffic, unique-buyer, acquisition-cost, or repeatable inbound-demand evidence is connected.', 15);
addLaw('C8', 'Positive unit economics and scalable capacity', positiveUnitEconomics, positiveUnitEconomics ? 'The bootstrap contains a passing unit-economics and delivery-capacity evidence check.' : 'Net margin, support time, refund/dispute rate, and repeatable delivery capacity have not been measured.', 10);

if (!offer) blockers.push({priority:1, blocker:'Truth Oracle first-dollar candidate not selected by the scout', remedy:'Keep Truth Oracle Access as the only evidence-review candidate and prove its fulfillment before enabling checkout.'});
if (!parity) blockers.push({priority:1, blocker:'Truth Oracle offer parity is not proven', remedy:'Verify root/public Truth Oracle pages agree, the retired route redirects, and checkout remains held.'});
if (!activeLink) blockers.push({priority:1, blocker:'Truth Oracle Access checkout is held pending fulfillment proof', remedy:'Keep the public checkout disabled until the existing link's entitlement and delivery path passes end-to-end.'});
if (!attributablePaidOrder) blockers.push({priority:1, blocker: paidSignal ? 'Paid session exists but independent order attribution is unproven' : 'No attributable Truth Oracle paid order evidenced', remedy:'Match the live payment to the approved offer, establish an independent buyer/order without retaining unnecessary PII, and separately reconcile refunds, disputes and payout.'});
if (!fulfillmentProven) blockers.push({priority:1, blocker:'Truth Oracle payment-to-delivery chain is unproven', remedy:'Complete one controlled paid-order fulfillment with buyer authorization; produce the report and record payment attribution, artifact hash/reference and delivery timestamp.'});
if (!deliveryEvidence) blockers.push({priority:1, blocker:'No delivery evidence', remedy:'Persist a minimal delivery receipt linked to the order, without storing unnecessary buyer personal data.'});
if (checkoutStarts > 0 && !paidSignal) blockers.push({priority:2, blocker:'Checkout starts have not converted to matched paid sessions', remedy:'Inspect price, payment methods, mobile checkout usability, trust/expectations and abandoned-session patterns before increasing traffic.'});
if (checkoutStarts === 0) blockers.push({priority:2, blocker:'No checkout-start signal for the held Truth Oracle Access product in the live Stripe report', remedy:'First instrument production page visits and CTA clicks with privacy-conscious analytics, then test a real inbound distribution surface.'});
blockers.push({priority:2, blocker:'Demand acquisition and unit economics are not measured', remedy:'After Truth Oracle fulfillment is proven, measure source → qualified visit → checkout start → paid order → delivered evidence result, plus delivery minutes and net contribution. Scale only after repeatability.'});
blockers.push({priority:3, blocker:'Supabase remains an external fulfillment risk for other offers', remedy:'Keep Truth Oracle as the single evidence-review surface; do not enable paid access until database persistence, entitlement, and delivery are proven. Do not reopen quote, billboard or automated fulfillment until database and delivery paths pass their own tests.'});

const score = laws.reduce((sum, law) => sum + law.points_awarded, 0);
const hardLawPassed = attributablePaidOrder && fulfillmentProven && deliveryEvidence && parity && activeLink && repeatableAcquisition && positiveUnitEconomics;
const verdict = hardLawPassed && score >= 80
  ? 'ELIGIBLE_FOR_SMALL_CONTROLLED_SCALE_NOT_A_WEALTH_GUARANTEE'
  : paidSignal
    ? 'PAYMENT_SIGNAL_ONLY_DO_NOT_SCALE_UNTIL_FULFILLMENT_AND_DEMAND_PASS'
    : 'FAIL_TO_PROVE_WEALTH_PATH_FIX_CONVERSION_AND_EVIDENCE_FIRST';
const proof = {
  schema: 'DREAMLEDGER-GAUNTLET-ECONOMIC-VERDICT/v1',
  generated_at_utc: new Date().toISOString(),
  verdict,
  score_out_of_100: score,
  interpretation: 'Readiness score, not a probability of getting rich, sales forecast, profit claim, or valuation.',
  hard_laws: laws,
  economic_baseline: {
    offer: 'Truth Oracle Access',
    price_nzd: 49,
    matched_paid_sessions_observed: paid.length,
    gross_revenue_nzd_from_matched_sessions: paid.length * 49,
    verified_business_revenue_nzd: 0,
    verified_fulfillment: fulfillmentProven,
    verified_delivery: deliveryEvidence,
    checkout_sessions_started: checkoutStarts,
    evidence_freshness: { bootstrap_run_start_present: Number.isFinite(runStartedAt), scout_current_for_run: freshScout, stripe_current_for_run: freshStripe },
    checkout_paid_rate: funnel?.paid_rate_per_checkout_session_started ?? null,
    gross_sales_for_nzd_1000: Math.ceil(1000 / 49),
    gross_sales_for_nzd_10000: Math.ceil(10000 / 49),
    gross_sales_for_nzd_1000000: Math.ceil(1000000 / 49),
    bank_payout_or_net_profit_verified: false
  },
  blockers_and_remedies: blockers.sort((a,b) => a.priority - b.priority),
  scale_rule: 'Do not add offers or increase acquisition spend until one independent buyer pays, receives the promised deliverable, delivery evidence is recorded, and a repeatable acquisition source is measured. This first controlled validation is not proof of future wealth.',
  evidence_sources: [
    'proof/commerce/latest-monetization-scout.json',
    'proof/commerce/latest-first-dollar-stripe-reconciliation.json',
    'proof/commerce/latest-economic-validation.json'
  ]
};
fs.mkdirSync(path.join(root, 'proof/commerce'), {recursive:true});
fs.writeFileSync(path.join(root, 'proof/commerce/latest-gauntlet-economic-verdict.json'), JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));
if (!hardLawPassed) process.exitCode = 2;
