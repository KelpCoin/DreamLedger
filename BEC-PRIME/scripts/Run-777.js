'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'compiled', 'opportunities', 'ECONOMIC_GAUNTLET.json');
const APPROVED = path.join(ROOT, 'catalog', 'offers', 'approved.json');
const LIVE_COMMERCE = path.join(ROOT, 'catalog', 'commerce-live.json');
const BUYER_SIGNALS = path.join(ROOT, 'data', '777', 'BUYER-SIGNAL-HUNT-001.json');
const EVERGREEN_FACTORY = path.join(ROOT, '..', 'public', 'evergreen-silo-factory.json');
const CUBE_POLICY = path.join(ROOT, 'economic', 'CUBE_EXPERIMENT_POLICY.json');
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

// Evidence proximity to money. Higher means closer to an independently verifiable
// economic event. This orders machine attention, not revenue truth.
const EVIDENCE_PRIORITY = {
  SETTLED_PAYMENT: 100,
  CHECKOUT: 90,
  REPEAT_CHECKOUT: 80,
  EXPLICIT_PAID_REQUEST: 70,
  EXPLICIT_BUYING_INTENT: 60,
  GENERAL_PROBLEM_SIGNAL: 10,
  INTERNAL: 0
};

function classifyEvidence(seed) {
  const source = String(seed.source_type || '').toUpperCase();
  if (source === 'SETTLED_PAYMENT') return ['SETTLED_PAYMENT', EVIDENCE_PRIORITY.SETTLED_PAYMENT];
  if (source === 'CHECKOUT' || source === 'STRIPE_CHECKOUT') return ['CHECKOUT', EVIDENCE_PRIORITY.CHECKOUT];
  if (source === 'REPEAT_CHECKOUT') return ['REPEAT_CHECKOUT', EVIDENCE_PRIORITY.REPEAT_CHECKOUT];
  if (source === 'PUBLIC_BUYER_SIGNAL') {
    const text = JSON.stringify(seed).toLowerCase();
    if (/\bpaid\b|\bpaying\b|\bbudget\b|\bprice\b/.test(text)) {
      return ['EXPLICIT_BUYING_INTENT', EVIDENCE_PRIORITY.EXPLICIT_BUYING_INTENT];
    }
    return ['GENERAL_PROBLEM_SIGNAL', EVIDENCE_PRIORITY.GENERAL_PROBLEM_SIGNAL];
  }
  if (source === 'APPROVED_OFFER' || source === 'LIVE_COMMERCE') return ['INTERNAL', EVIDENCE_PRIORITY.INTERNAL];
  return ['GENERAL_PROBLEM_SIGNAL', EVIDENCE_PRIORITY.GENERAL_PROBLEM_SIGNAL];
}

const PRICING_RESEARCH = {
  schema: 'DREAMLEDGER/PRICING-ELASTICITY/v1',
  status: 'HYPOTHESIS_ONLY',
  price_points_nzd: [9,19,29,39,49,59,79,99,149,199,249,399,499,999],
  rules: ['LEFT_DIGIT','ANCHOR','THREE_TIER','DECOY','BUNDLE','PREMIUM_SIGNAL','PRICE_FENCE','ROUND_VS_ODD'],
  elasticity_rule: 'Do not estimate elasticity without comparable external transaction observations at different prices.'
};

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
        title: x.name || x.product_sku || x.offer_id,
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
          approval_required: false,
          reconciliation: 'APPROVED'
        }
      }))
    : [];

  const approvedById = new Map(
    approvedOffers.map(x => [x.commercial_activation?.offer_id, x])
  );

  const liveOffers = Array.isArray(liveCommerce.offers)
    ? liveCommerce.offers.map(x => {
        const approvedMatch = approvedById.get(x.offer_id);
        const reconciliation = approvedMatch
          ? (approvedMatch.commercial_activation.payment_link_url === x.checkout ? 'MATCH' : 'CONFLICT')
          : 'UNMATCHED_LIVE_CATALOG';

        return {
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
            fulfillment_route: approvedMatch?.commercial_activation.fulfillment_route || null,
            proof_of_delivery: approvedMatch?.commercial_activation.proof_of_delivery ||
              'Stripe-confirmed external payment plus canonical fulfillment evidence',
            approval_required: false,
            reconciliation
          }
        };
      })
    : [];

  const buyerSignals = Array.isArray(buyerSignalHunt.candidates)
    ? buyerSignalHunt.candidates.map(x => ({
        opportunity_id: x.candidate_id || null,
        title: x.title || null,
        buyer: x.buyer || x.target_buyer || 'PUBLICLY_OBSERVED_RELEVANT_HUMAN',
        offer: x.offer || x.proposed_offer || null,
        price_nzd: Number(x.price_nzd || 0),
        channels: [x.surface || x.channel || 'public_surface'],
        hypothesis: x.observed_problem || x.problem || null,
        source_type: 'PUBLIC_BUYER_SIGNAL',
        commercial_activation: {
          offer_id: x.offer_id || null,
          payment_link_url: x.payment_link || null,
          payment_link_status: x.payment_link ? 'CONFIGURED' : 'NOT_CONFIGURED',
          fulfillment_route: x.fulfillment_route || null,
          proof_of_delivery: x.proof_of_delivery || null,
          approval_required: true,
          source_url: x.url || null,
          permission_status: x.permission || 'UNVERIFIED_SURFACE_RULES',
          gauntlet_status: 'PENDING'
        }
      }))
    : [];

  const discovered = Array.isArray(source.results)
    ? source.results.filter(x => x && x.verdict === 'PASS').map(x => ({
        ...x,
        source_type: x.source_type || 'DISCOVERED_OPPORTUNITY',
        commercial_activation: x.commercial_activation || null
      }))
    : [];

  const seen = new Set();
  return [...approvedOffers, ...liveOffers, ...buyerSignals, ...discovered].filter(x => {
    const id = x.opportunity_id || x.offer_id || x.product_sku || x.title;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
function buildEvergreenExpansion(seed) {
  const factory = loadJson(EVERGREEN_FACTORY, { live_adapters: [] });
  const policy = loadJson(CUBE_POLICY, { cube_state_machine: [], promotion_rules: {} });
  const adapters = Array.isArray(factory.live_adapters) ? factory.live_adapters : [];
  if (!seed || adapters.length === 0) {
    return {
      status: 'HOLD',
      reason: seed ? 'NO_EXISTING_EVERGREEN_ADAPTERS' : 'NO_QUALIFIED_SEED',
      batch_size: 0,
      variants: [],
      telemetry: [],
      promotion: policy.promotion_rules || {}
    };
  }

  // Recombine existing commercial substrate only. This creates an experiment
  // packet, not a public launch and not a revenue claim.
  const batchSize = Math.min(10, adapters.length);
  const selected = adapters.slice(0, batchSize);
  const marketingLanes = [
    'SEARCH_INTENT',
    'COMMUNITY_EDUCATION',
    'BUYER_PROBLEM_CONTENT',
    'DIRECTORY_DISCOVERY',
    'REFERRAL'
  ];

  const variants = selected.map((adapter, i) => ({
    variant_id: 'EVERGREEN-777-' + String(i + 1).padStart(2, '0'),
    silo_slug: adapter.slug,
    brand_name: adapter.name,
    source_adapter: adapter.slug,
    source_checkout_url: adapter.checkout_url || null,
    offer_family: adapter.fulfillment || 'UNSPECIFIED',
    state: 'PROBING',
    public_launch: 'APPROVAL_REQUIRED',
    buyer_signal_binding: seed.opportunity_id || seed.candidate_id || null,
    evidence_class: classifyEvidence(seed)[0],
    evidence_priority: classifyEvidence(seed)[1],
    marketing_lane: marketingLanes[i % marketingLanes.length],
    telemetry: {
      exposures: 0,
      qualified_clicks: 0,
      checkout_starts: 0,
      settled_payments: 0,
      fulfilled_orders: 0,
      verified_outcomes: 0,
      acquisition_cost_nzd: 0,
      fulfillment_cost_nzd: 0,
      conversion: null,
      margin_nzd: null
    },
    promotion_gate: 'NO_PROMOTION_UNTIL_EXTERNAL_EVIDENCE',
    kill_gate: 'KILL_OR_HOLD_IF_NO_QUALIFIED_DEMAND_OR_FULFILLMENT_PROOF',
    inventory_claim: 'NONE'
  }));

  return {
    status: 'READY_FOR_GAUNTLET',
    batch_size: variants.length,
    batch_rule: 'LAUNCH_IN_BATCHES_OF_5_OR_10',
    allocation_rule: 'SUPPORT_ONLY_TOP_1_OR_2_AFTER_OBSERVED_EVIDENCE; HOLD_OR_KILL_THE_REST',
    source_substrate: 'EXISTING_EVERGREEN_SILO_FACTORY',
    seed_opportunity_id: seed.opportunity_id || seed.candidate_id || null,
    seed_evidence_class: classifyEvidence(seed)[0],
    variants,
    telemetry: {
      ranking_fields: ['settled_payments','verified_outcomes','checkout_starts','qualified_clicks','exposures','acquisition_cost_nzd','fulfillment_cost_nzd','margin_nzd'],
      truth_rule: 'telemetry_does_not_equal_revenue',
      winner_rule: policy.promotion_rules?.WINNER || 'EXTERNAL_EVIDENCE_REQUIRED',
      clone_rule: 'ONLY_INDEPENDENTLY_VERIFIED_ECONOMIC_MECHANISMS_MAY_BE_REPLICATED'
    },
    supabase_role: 'SILO_HOME_AND_TELEMETRY_AUTHORITY',
    local_llm_role: 'LM_STUDIO_WORKER_POOL_PROPOSES_AND_COMPILES_ONLY',
    supervisor_role: 'ALLOCATE_AVAILABLE_LOCAL_GPU_TO_BOUNDED_WORK; NEVER_AUTHORIZE_EXTERNAL_ACTION',
    external_action: 'NONE'
  };
}

function build() {
  const base = candidates();
  const top = base.slice(0, 49);
  const rows = [];
  let sequence = 0;

  for (const seed of top) {
    const [evidence_class, evidence_priority] = classifyEvidence(seed);
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
          evidence_class,
          evidence_priority,
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
          external_action: seed.commercial_activation?.payment_link_url ? 'GAUNTLET_GATE' : 'NO_EXTERNAL_ACTION'
        };

        candidate.integrity_sha256 = sha(JSON.stringify(candidate));
        rows.push(candidate);
      }
    }
  }

  rows.sort((a,b) => {
    if (b.evidence_priority !== a.evidence_priority) return b.evidence_priority - a.evidence_priority;
    const av = Number(a.hypothesis.price_nzd || 0);
    const bv = Number(b.hypothesis.price_nzd || 0);
    return bv - av;
  });

  const activation_candidates = rows
    .filter(x => x.commercial_activation &&
      x.commercial_activation.payment_link_url &&
      x.commercial_activation.fulfillment_route &&
      (!x.commercial_activation.reconciliation ||
        ['MATCH','APPROVED'].includes(x.commercial_activation.reconciliation)))
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

  const buyerSignalHunt = loadJson(BUYER_SIGNALS, { candidates: [] });
  const buyerSignals = Array.isArray(buyerSignalHunt.candidates)
    ? buyerSignalHunt.candidates.map(x => ({
        candidate_id: x.candidate_id || null,
        title: x.title || null,
        buyer: x.buyer || x.target_buyer || 'PUBLICLY_OBSERVED_RELEVANT_HUMAN',
        offer: x.offer || x.proposed_offer || null,
        price_nzd: Number(x.price_nzd || 0),
        surface: x.surface || x.channel || 'public_surface',
        url: x.url || null,
        offer_id: x.offer_id || null,
        permission: x.permission || 'UNVERIFIED_SURFACE_RULES'
      }))
    : [];

  const buyerSignalQueue = buyerSignals
    .map((x, index) => ({
      ...x,
      evidence_class: classifyEvidence(x)[0],
      evidence_priority: classifyEvidence(x)[1],
      queue_rank: index + 1
    }))
    .sort((a, b) => b.evidence_priority - a.evidence_priority || String(a.candidate_id).localeCompare(String(b.candidate_id)));

  const nextBuyerSignal = buyerSignalQueue[0] || null;
  const evergreenSeed = nextBuyerSignal
    ? {
        opportunity_id: nextBuyerSignal.candidate_id,
        candidate_id: nextBuyerSignal.candidate_id,
        title: nextBuyerSignal.title,
        buyer: nextBuyerSignal.buyer,
        offer: nextBuyerSignal.offer,
        price_nzd: nextBuyerSignal.price_nzd,
        source_type: 'PUBLIC_BUYER_SIGNAL'
      }
    : base.find(x => x.evidence_class === 'CHECKOUT' || x.evidence_class === 'REPEAT_CHECKOUT') || null;
  const evergreenExpansion = buildEvergreenExpansion(evergreenSeed);
  const nextHumanAction = nextBuyerSignal
    ? {
        required: true,
        type: 'REVIEW_AND_APPROVE_EXTERNAL_REPLY',
        candidate_id: nextBuyerSignal.candidate_id,
        surface: nextBuyerSignal.surface,
        source_url: nextBuyerSignal.url,
        offer_id: nextBuyerSignal.offer_id || null,
        price_nzd: Number(nextBuyerSignal.price_nzd || 0),
        boundary: 'NO_SEND_UNTIL_HUMAN_APPROVAL',
        payment_link_required: true
      }
    : null;

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
    pricing_research: PRICING_RESEARCH,
    buyer_signal_count: buyerSignals.length,
    buyer_signal_queue: buyerSignalQueue,
    next_human_action: nextHumanAction,
    evergreen_expansion: evergreenExpansion,
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

module.exports = { build, buildEvergreenExpansion, LENSES, TRANSFORMS, GATES };
