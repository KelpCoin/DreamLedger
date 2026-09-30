'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'compiled', 'opportunities', 'ECONOMIC_GAUNTLET.json');
const APPROVED = path.join(ROOT, 'catalog', 'offers', 'approved.json');
const LIVE_COMMERCE = path.join(ROOT, 'catalog', 'commerce-live.json');
const BUYER_SIGNALS = path.join(ROOT, 'data', '777', 'BUYER-SIGNAL-HUNT-001.json');
const OUT_DIR = path.join(ROOT, 'data', '777');
const OUT = path.join(OUT_DIR, '777-LATEST.json');

const sha = v => crypto.createHash('sha256').update(v, 'utf8').digest('hex');

const LENSES = [
  'BUYER','PROBLEM','OFFER','CHANNEL','PRICE','FULFILLMENT','PROOF'
];

const TRANSFORMS = [
  'NARROW','BUNDLE','SPLIT','REPEAT','MONITOR','VERIFY','BROKER'
];

const GATES = [
  'DEMAND','CAPABILITY','ZERO_COST','FULFILLMENT','PAYMENT','REPEAT','CONTRADICTION'
];

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function candidates() {
  const source = loadJson(SOURCE, { results: [] });
  const approved = loadJson(APPROVED, { approved: [] });
  const liveCommerce = loadJson(LIVE_COMMERCE, { offers: [] });
  const buyerSignalHunt = loadJson(BUYER_SIGNALS, { candidates: [] });
  const approvedOffers = Array.isArray(approved.approved)
    ? approved.approved.map(x => ({
        opportunity_id: 'APPROVED-OFFER:' + (x.offer_id || x.product_sku || 'UNKNOWN'),
        title: x.name || x.product_sku,
        buyer: x.target_buyer || null,
        offer: x.deliverable || x.name || null,
        price_nzd: Number(x.price || 0),
        channels: [x.acquisition_surface || 'configured'],
        hypothesis: x.problem || null,
        source_type: 'APPROVED_OFFER',
        commercial_activation: {
          offer_id: x.offer_id || null,
          payment_link_url: x.payment_link_url || null,
          payment_link_status: x.payment_link_status || null,
          fulfillment_route: x.fulfillment_route || null,
          proof_of_delivery: x.proof_of_delivery || null,
          approval_required: x.approved_by ? true : false
        }
      }))
    : [];

  const approvedById = new Map(approvedOffers.map(x => [x.commercial_activation?.offer_id, x]));
  const liveOffers = Array.isArray(liveCommerce.offers)
    ? liveCommerce.offers.map(x => ({
        opportunity_id: 'LIVE-COMMERCE:' + (x.offer_id || 'UNKNOWN'),
        title: x.offer_id || 'Live commercial offer',
        buyer: null,
        offer: x.offer_id || null,
        price_nzd: Number(x.price_nzd || 0),
        channels: ['stripe_payment_link'],
        hypothesis: 'Existing operator-authorized live commerce surface',
        source_type: 'LIVE_COMMERCE',
        commercial_activation: {
          offer_id: x.offer_id || null,
          payment_link_url: x.checkout || null,
          payment_link_status: x.status || null,
          fulfillment_route: null,
          proof_of_delivery: 'Stripe-confirmed external payment plus canonical fulfillment evidence',
          approval_required: false,
          reconciliation: approvedById.has(x.offer_id)
            ? (approvedById.get(x.offer_id).commercial_activation.payment_link_url === x.checkout ? 'MATCH' : 'CONFLICT')
            : 'UNMATCHED_LIVE_CATALOG'
        }
      }))
    : [];

  const buyerSignals = Array.isArray(buyerSignalHunt.candidates)
    ? buyerSignalHunt.candidates.map(x => ({
        opportunity_id: x.candidate_id || null,
        title: x.title || null,
        buyer: 'PUBLICLY_OBSERVED_RELEVANT_HUMAN',
        offer: 'COMMANDER-DECK-DIAGNOSTIC-001',
        price_nzd: 29,
        channels: [x.surface || 'public_surface'],
        hypothesis: x.observed_problem || null,
        source_type: 'PUBLIC_BUYER_SIGNAL',
        commercial_activation: {
          offer_id: 'OFFER-CMD-DIAG-29-NZD',
          payment_link_url: null,
          payment_link_status: 'EXTERNAL_ACTION_BLOCKED',
          fulfillment_route: 'existing_commander_diagnostic_fulfillment',
          proof_of_delivery: 'Stripe-confirmed payment plus canonical fulfillment evidence',
          approval_required: true,
          source_url: x.url || null,
          permission_status: x.permission || 'UNVERIFIED_SURFACE_RULES',
          gauntlet_status: 'PENDING'
        }
      }))
    : [];

  const discovered = Array.isArray(source.results)
    ? source.results.filter(x => x && x.verdict === 'PASS')
    : [];

  const buyerSignals = Array.isArray(publicRadar.candidates)
    ? publicRadar.candidates
        .filter(x => x && x.url && x.title && x.signal_type === 'PUBLIC_DECK_TUNING_PROBLEM')
        .map(x => ({
          candidate_id: x.candidate_id || null,
          title: x.title,
          url: x.url,
          surface: x.surface || null,
          subreddit: x.subreddit || null,
          published: x.published || null,
          matched_signal: x.matched_signal || null,
          problem_signal: x.problem_signal || 'OBSERVED_PUBLIC_REQUEST_FOR_DECK_HELP',
          buyer_signal: x.buyer_signal || 'DEMONSTRATED_PROBLEM',
          commercial_fit: x.commercial_fit || 'DIRECT_TO_COMMANDER_DIAGNOSTIC',
          offer_id: x.offer_id || 'OFFER-CMD-DIAG-29-NZD',
          price_nzd: Number(x.price_nzd || 29),
          permission_status: x.permission_status || 'UNKNOWN_REQUIRES_SURFACE_RULE_CHECK',
          external_action: 'HUMAN_APPROVAL_REQUIRED',
          outreach_status: 'NOT_CONTACTED',
          truth_status: 'UNVERIFIED_DEMAND_SIGNAL',
          gauntlet_status: 'PENDING_SURFACE_JUDGMENT'
        }))
        .slice(0, 1000)
    : [];

  // Keep already-approved commercial substrate first-class in 777.
  const seen = new Set();
  const base = [...buyerSignals, ...approvedOffers, ...liveOffers, ...discovered].filter(x => {
    const id = x.opportunity_id || x.offer_id || x.product_sku || x.title;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return base;
}

function build() {
  const base = candidates();
  const top = base.slice(0, 49);
  const rows = [];
  let sequence = 0;

  for (const seed of top) {
    for (const lens of LENSES) {
      for (const transform of TRANSFORMS) {
        const gate = GATES[sequence % GATES.length];
        sequence += 1;

        const candidate = {
          candidate_id: '777-' + sha(JSON.stringify({
            seed: seed.opportunity_id,
            lens, transform, gate
          })).slice(0, 20).toUpperCase(),
          seed_opportunity_id: seed.opportunity_id || null,
          seed_title: seed.title || null,
          search_mode: '777_HYPOTHESIS_GENERATION',
          lens,
          transform,
          gate,
          hypothesis: {
            buyer: seed.buyer || null,
            problem: seed.hypothesis || null,
            offer: seed.offer || null,
            price_nzd: Number(seed.price_nzd || 0),
            channels: Array.isArray(seed.channels) ? seed.channels : [],
            transformation: transform
          },
          evidence_boundary: {
            source_seed_only: true,
            buyer_invented: false,
            payment_invented: false,
            revenue_claim: false,
            fulfillment_claim: false
          },
          commercial_activation: seed.commercial_activation || null,
          status: 'HYPOTHESIS_UNVERIFIED',
          next_test: gate,
          external_action: 'APPROVAL_REQUIRED'
        };

        candidate.integrity_sha256 = sha(JSON.stringify(candidate));
        rows.push(candidate);
      }
    }
  }

  rows.sort((a,b) => {
    const av = Number(a.hypothesis.price_nzd || 0);
    const bv = Number(b.hypothesis.price_nzd || 0);
    return bv - av;
  });

  const activation_candidates = rows
    .filter(x => x.commercial_activation && x.commercial_activation.payment_link_url &&
      (!x.commercial_activation.reconciliation || x.commercial_activation.reconciliation === 'MATCH'))
    .map(x => ({
      candidate_id: x.candidate_id,
      seed_opportunity_id: x.seed_opportunity_id,
      title: x.seed_title,
      offer: x.hypothesis.offer,
      price_nzd: x.hypothesis.price_nzd,
      payment_link_url: x.commercial_activation.payment_link_url,
      payment_link_status: x.commercial_activation.payment_link_status,
      fulfillment_route: x.commercial_activation.fulfillment_route,
      proof_of_delivery: x.commercial_activation.proof_of_delivery,
      next_test: x.next_test,
      status: x.status,
      external_action: x.external_action,
      reconciliation: x.commercial_activation.reconciliation || 'APPROVED_ONLY'
    }));

  const out = {
    schema_version: 'DREAMLEDGER/777/v1',
    generated_at_utc: new Date().toISOString(),
    objective: 'continuously search combinations of already-observed economic primitives without inventing buyers, payments, fulfillment, evidence, or revenue',
    search_space: {
      lenses: LENSES,
      transforms: TRANSFORMS,
      gates: GATES,
      theoretical_modes_per_seed: LENSES.length * TRANSFORMS.length * GATES.length
    },
    seed_count: top.length,
    candidate_count: rows.length,
    activation_candidate_count: activation_candidates.length,
    activation_candidates,
    buyer_signal_count: buyerSignals.length,
    buyer_signal_queue: buyerSignals,
    candidates: rows.slice(0, 777),
    truth: {
      verified_external_revenue_nzd: 0,
      settled_external_payments: 0,
      independent_external_buyers: 0,
      verified_economic_outcomes: 0,
      status: 'UNCHANGED'
    }
  };

  out.integrity_sha256 = sha(JSON.stringify(out));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');

  return out;
}

if (require.main === module) {
  const r = build();
  console.log(JSON.stringify({
    status: 'PASS',
    mode: r.schema_version,
    seed_count: r.seed_count,
    candidate_count: r.candidate_count,
    truth: r.truth,
    output: OUT
  }, null, 2));
}

module.exports = { build, LENSES, TRANSFORMS, GATES };
