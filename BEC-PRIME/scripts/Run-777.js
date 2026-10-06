// 777 runtime trigger: execute the already-assembled acceptance substrate on the next scheduled/push run.
// 777 runtime wake: reassemble existing CUBE -> SILO -> ELOHIM -> TRUTH -> GAUNTLET -> COMMERCE substrate.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { assessEconomicEvidence, summarizeEvidenceLadder, isActionableBuyerSignal, hasExplicitPaymentIntent } = require('../economic/EconomicEvidenceLadder');
const { buildModularFactories } = require('../compiler/FactoryFactory');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'compiled', 'opportunities', 'ECONOMIC_GAUNTLET.json');
const APPROVED = path.join(ROOT, 'catalog', 'offers', 'approved.json');
const LIVE_COMMERCE = path.join(ROOT, 'catalog', 'commerce-live.json');
const BUYER_SIGNALS = path.join(ROOT, 'data', '777', 'BUYER-SIGNAL-HUNT-001.json');
const PUBLIC_MARKET_RADAR = path.join(ROOT, 'data', '777', 'public-market-radar.json');
const EVERGREEN_FACTORY = path.join(ROOT, '..', 'public', 'evergreen-silo-factory.json');
const CUBE_POLICY = path.join(ROOT, 'economic', 'CUBE_EXPERIMENT_POLICY.json');
const TRUTH_ORACLE_PRICING = path.join(ROOT, 'catalog', 'truth-oracle', 'pricing.json');
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

// Phase-2 controlled experiment identities. These are lanes, not brands,
// public launches, or economic claims. They activate only after VERIFIED.
const EXPERIMENT_LANES = [
  { lane_id: 'LANE-A', strategy: 'PROBLEM_FIRST' },
  { lane_id: 'LANE-B', strategy: 'AUDIT_FIRST' },
  { lane_id: 'LANE-C', strategy: 'SAVINGS_FIRST' },
  { lane_id: 'LANE-D', strategy: 'RISK_FIRST' },
  { lane_id: 'LANE-E', strategy: 'OUTCOME_FIRST' }
];

// Amber Room: economic gravity is an allocation signal, never economic truth.
// It concentrates bounded internal work on opportunities with observable value,
// buyer specificity, commercial readiness and repeatability without granting
// external authority or replication rights.
function goldenScore(candidate) {
  const price = Math.max(0, Number(candidate.hypothesis?.price_nzd ?? candidate.price_nzd ?? 0));
  const evidence = Math.min(1, Number(candidate.economic_evidence?.evidence_rung ?? 0) / 5);
  const activation = candidate.commercial_activation || {};
  const readiness = [activation.payment_link_url, activation.fulfillment_route, activation.proof_of_delivery].filter(Boolean).length / 3;
  const buyer = candidate.hypothesis?.buyer || candidate.buyer;
  const buyerSpecificity = buyer ? 1 : 0;
  const repeatability = /repeat|subscription|recurring|monitor/i.test(String(candidate.hypothesis?.transformation || candidate.repeatability || '')) ? 1 : 0.5;
  const gravity = Math.min(1, Math.log10(price + 10) / 3);
  const score = Number((100 * (0.35 * gravity + 0.20 * evidence + 0.20 * readiness + 0.15 * buyerSpecificity + 0.10 * repeatability)).toFixed(4));
  return { score, authority: 'ALLOCATION_ONLY', truth_authority: 'TRUTH_ORACLE', replication_permission: false };
}

function buildGoldenAllocation(rows) {
  return rows
    .map(x => ({ ...x, golden: goldenScore(x) }))
    .sort((a,b) => b.golden.score - a.golden.score || b.evidence_priority - a.evidence_priority)
    .slice(0, 12)
    .map((x, i) => ({
      rank: i + 1,
      candidate_id: x.candidate_id,
      seed_opportunity_id: x.seed_opportunity_id,
      score: x.golden.score,
      allocation: i < 2 ? 'ELEVATE_INTERNAL' : 'PROBE_OR_HOLD',
      external_action: 'BLOCKED',
      truth_status: 'UNVERIFIED',
      replication_permission: false
    }));
}

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
    if (hasExplicitPaymentIntent(seed)) {
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
  const buyerSignalHunt = loadJson(BUYER_SIGNALS, { candidates: [], offer: {} });
  const buyerSignalOffer = buyerSignalHunt.offer || {};
  const publicMarketRadar = loadJson(PUBLIC_MARKET_RADAR, { candidates: [] });
  const radarGeneratedAt = Date.parse(publicMarketRadar.generated_at_utc || '');
  const publicRadarFresh = Number.isFinite(radarGeneratedAt) && radarGeneratedAt <= Date.now() && (Date.now() - radarGeneratedAt) <= 30 * 60 * 1000;
  const publicRadarSignals = publicRadarFresh && Array.isArray(publicMarketRadar.candidates)
    ? publicMarketRadar.candidates.map(x => ({
        ...x,
        opportunity_id: x.candidate_id || x.url || null,
        buyer: 'UNVERIFIED_AUTHOR_ROLE',
        offer: 'QUOTE-COMPARE-49 offer hypothesis only',
        offer_id: 'QUOTE-COMPARE-49',
        price_nzd: 49,
        source_type: 'PUBLIC_BUYER_SIGNAL',
        permission: 'UNVERIFIED_SURFACE_RULES',
        economic_evidence: x.economic_evidence || assessEconomicEvidence(x),
        commercial_activation: {
          offer_id: 'QUOTE-COMPARE-49',
          payment_link_url: null,
          payment_link_status: 'UNVERIFIED',
          fulfillment_route: null,
          proof_of_delivery: null,
          approval_required: true,
          source_url: x.url || null,
          permission_status: 'UNKNOWN_REQUIRES_SURFACE_RULE_CHECK',
          gauntlet_status: 'PENDING'
        }
      }))
    : [];
  const evergreenFactory = loadJson(EVERGREEN_FACTORY, { live_adapters: [] });
  const truthOraclePricing = loadJson(TRUTH_ORACLE_PRICING, { plans: [] });
  const recurringTruthOracleOffers = Array.isArray(truthOraclePricing.plans)
    ? truthOraclePricing.plans.filter(x => Number(x.price_nzd_month || 0) > 0 && x.stripe_price_id).map(x => ({
        opportunity_id: 'TRUTH-ORACLE-SUBSCRIPTION:' + String(x.tier || 'UNKNOWN'),
        title: 'Truth Oracle ' + String(x.display_name || x.tier || 'subscription'),
        buyer: 'Independent buyer seeking recurring economic evidence access',
        offer: x.description || 'Recurring Truth Oracle evidence access',
        price_nzd: Number(x.price_nzd_month || 0),
        channels: ['existing_truth_oracle_subscription_surface'],
        hypothesis: 'EXISTING_RECURRING_SURFACE: monthly access to deeper economic evidence without changing the verdict',
        source_type: 'EXISTING_RECURRING_SURFACE',
        repeatability: 'subscription',
        commercial_activation: {
          offer_id: 'TRUTH-ORACLE-SUBSCRIPTION:' + String(x.tier || 'UNKNOWN'),
          payment_link_url: '/api/truth-oracle/checkout',
          payment_link_status: 'EXISTING_SUBSCRIPTION_CHECKOUT_ENDPOINT',
          fulfillment_route: '/api/truth-oracle/access',
          proof_of_delivery: 'Entitlement plus gated Truth Oracle access and provider renewal evidence',
          approval_required: true,
          reconciliation: 'EXISTING_IMPLEMENTED_RECURRING_SURFACE',
          stripe_price_id: x.stripe_price_id
        }
      }))
    : [];
  const quoteComparisonAdapter = (evergreenFactory.live_adapters || []).find(x =>
    x.slug === 'construction-subcontractor-quotes' ||
    x.slug === 'supplier-price-list-comparison'
  );

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

  const staticBuyerSignals = Array.isArray(buyerSignalHunt.candidates)
    ? buyerSignalHunt.candidates.map(x => ({
        opportunity_id: x.candidate_id || null,
        title: x.title || null,
        buyer: x.buyer || x.target_buyer || 'PUBLICLY_OBSERVED_RELEVANT_HUMAN',
        offer: x.offer || x.proposed_offer || buyerSignalOffer.product_id || buyerSignalOffer.offer_id || null,
        price_nzd: Number(x.price_nzd || buyerSignalOffer.price_nzd || 0),
        observed_problem: x.observed_problem || x.problem || null,
        signal_terms: Array.isArray(x.signal_terms) ? x.signal_terms : [],
        channels: [x.surface || x.channel || 'public_surface'],
        hypothesis: x.observed_problem || x.problem || null,
        source_type: 'PUBLIC_BUYER_SIGNAL',
        commercial_activation: {
          offer_id: x.offer_id || buyerSignalOffer.offer_id || null,
          payment_link_url: x.payment_link || buyerSignalOffer.payment_link || null,
          payment_link_status: (x.payment_link || buyerSignalOffer.payment_link) ? 'CONFIGURED' : 'NOT_CONFIGURED',
          fulfillment_route: x.fulfillment_route || null,
          proof_of_delivery: x.proof_of_delivery || null,
          approval_required: true,
          source_url: x.url || null,
          permission_status: x.permission || 'UNVERIFIED_SURFACE_RULES',
          gauntlet_status: 'PENDING'
        }
      }))
    : [];

  const buyerSignals = [...publicRadarSignals, ...staticBuyerSignals];

  const recurringSurfaces = recurringTruthOracleOffers;

  const discovered = Array.isArray(source.results)
    ? source.results.filter(x => x && x.verdict === 'PASS' && assessEconomicEvidence(x).evidence_rung >= 1).map(x => ({
        ...x,
        source_type: x.source_type || 'DISCOVERED_OPPORTUNITY',
        commercial_activation: x.commercial_activation || null
      }))
    : [];

  const quoteCompareCandidates = quoteComparisonAdapter ? [{
    opportunity_id: 'QUOTE-COMPARE-49',
    candidate_id: 'QUOTE-COMPARE-49',
    title: 'Supplier quote comparison (existing B2B offer candidate)',
    buyer: 'Business or operator already holding supplier quotes',
    offer: 'NZ$49 like-for-like quote comparison with scope gaps, exclusions, and unknowns preserved',
    price_nzd: 49,
    channels: [quoteComparisonAdapter.route || 'existing_b2b_offer_surface'],
    hypothesis: 'UNVALIDATED_HYPOTHESIS: a buyer with 2-5 supplier quotes may pay for a source-referenced comparison decision packet',
    source_type: 'EXISTING_B2B_OFFER_CANDIDATE',
    source_url: null,
    source_observed_at: null,
    commercial_activation: {
      offer_id: null,
      payment_link_url: null,
      payment_link_status: 'BLOCKED_SHARED_CHECKOUT_UNVERIFIED',
      fulfillment_route: null,
      proof_of_delivery: 'Source-referenced comparison artifact plus delivery evidence',
      approval_required: true,
      reconciliation: 'UNVERIFIED_ROUTE_CHECKOUT_AND_ATTRIBUTION'
    }
  }] : [];

  const seen = new Set();
  return [...approvedOffers, ...liveOffers, ...recurringSurfaces, ...buyerSignals, ...discovered, ...quoteCompareCandidates].filter(x => {
    const id = x.opportunity_id || x.offer_id || x.product_sku || x.title;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
function buildEvergreenExpansion(seed) {
  // 777 core rule: economically interesting substrate may enter a bounded CUBE
  // probe before verification. Verification is required for REPLICATION, not
  // for DISCOVERY/PROBING. This breaks the old chicken-and-egg condition where
  // Evergreen could only populate from an already VERIFIED mechanism.
  const evidence = seed ? assessEconomicEvidence(seed) : null;
  const hasSubstrate = Boolean(seed) && (
    Number(evidence?.evidence_rung || 0) >= 0 &&
    Boolean(seed.opportunity_id || seed.candidate_id || seed.title)
  );

  if (!hasSubstrate) {
    return {
      status: 'HOLD_NO_SUBSTRATE',
      reason: 'CUBE probing requires an observable economic substrate; replication still requires VERIFIED.',
      batch_size: 0,
      variants: [],
      telemetry: {
        lanes: EXPERIMENT_LANES,
        ranking_fields: ['qualified_signals','checkout_starts','settled_payments','fulfilled_orders','verified_outcomes','human_touches','time_to_fulfill','margin_nzd'],
        truth_rule: 'telemetry_does_not_equal_revenue',
        winner_rule: 'NO_WINNER_UNTIL_EXTERNAL_EVIDENCE',
        clone_rule: 'ONLY_VERIFIED_MECHANISMS_MAY_BE_REPLICATED'
      },
      source_substrate: 'ECONOMIC_SUBSTRATE',
      external_action: 'NONE',
      phase: 'FIND_THE_HOLE'
    };
  }

  const factory = loadJson(EVERGREEN_FACTORY, { live_adapters: [] });
  const policy = loadJson(CUBE_POLICY, { cube_state_machine: [], promotion_rules: {} });
  const adapters = Array.isArray(factory.live_adapters) ? factory.live_adapters : [];

  const approved = loadJson(APPROVED, { approved: [] });
  const liveCommerce = loadJson(LIVE_COMMERCE, { offers: [] });
  const capabilitySubstrate = [
    ...adapters.map(x => ({
      source_type: 'EVERGREEN_ADAPTER',
      slug: x.slug,
      name: x.name,
      checkout_url: x.checkout_url || null,
      fulfillment: x.fulfillment || null
    })),
    ...(Array.isArray(approved.approved) ? approved.approved.map(x => ({
      source_type: 'APPROVED_OFFER',
      slug: x.offer_id || x.product_sku || null,
      name: x.name || x.offer_id || x.product_sku || null,
      checkout_url: x.payment_link_url || null,
      fulfillment: x.fulfillment_route || null
    })) : []),
    ...(Array.isArray(liveCommerce.offers) ? liveCommerce.offers.map(x => ({
      source_type: 'LIVE_COMMERCE',
      slug: x.offer_id || null,
      name: x.offer_id || null,
      checkout_url: x.checkout || null,
      fulfillment: null
    })) : [])
  ].filter(x => x.slug);

  const seedText = JSON.stringify(seed).toLowerCase();
  const tokens = (seedText.match(/[a-z0-9]{4,}/g) || [])
    .filter(t => !['publicly','observed','relevant','human','signal','help','some','with','new','null','true','false'].includes(t));

  const relevant = capabilitySubstrate.filter(item => {
    const itemText = JSON.stringify(item).toLowerCase();
    return tokens.some(t => itemText.includes(t));
  });

  const pool = relevant.length ? relevant : capabilitySubstrate;
  if (pool.length === 0) {
    return {
      status: 'HOLD_NO_EXISTING_CAPABILITY_SUBSTRATE',
      reason: 'No existing Evergreen/approved/live commerce capability is available to populate a CUBE probe. Do not invent capability.',
      batch_size: 0,
      variants: [],
      telemetry: [],
      promotion: policy.promotion_rules || {},
      source_substrate: 'ECONOMIC_SUBSTRATE',
      seed_opportunity_id: seed.opportunity_id || seed.candidate_id || null
    };
  }

  const batchSize = Math.min(10, Math.max(5, pool.length));
  const marketingLanes = [
    'SEARCH_INTENT',
    'COMMUNITY_EDUCATION',
    'BUYER_PROBLEM_CONTENT',
    'DIRECTORY_DISCOVERY',
    'REFERRAL',
    'OUTCOME_FIRST',
    'SAVINGS_FIRST',
    'RISK_FIRST',
    'AUDIT_FIRST',
    'PROBLEM_FIRST'
  ];

  const selected = Array.from({ length: batchSize }, (_, i) => pool[i % pool.length]);
  const variants = selected.map((capability, i) => {
    const lane = marketingLanes[i % marketingLanes.length];
    const variantId = 'CUBE-777-' + String(i + 1).padStart(2, '0');
    return {
      variant_id: variantId,
      silo_slug: 'CUBE-PROBE-' + String(i + 1).padStart(2, '0'),
      brand_name: capability.name || capability.slug,
      source_capability: capability.slug,
      source_type: capability.source_type,
      source_checkout_url: capability.checkout_url,
      offer_family: capability.fulfillment || 'INTERNAL_PROBE',
      state: 'PROBING',
      public_launch: 'APPROVAL_REQUIRED',
      buyer_signal_binding: seed.opportunity_id || seed.candidate_id || null,
      marketing_lane: lane,
      evidence_class: classifyEvidence(seed)[0],
      evidence_priority: classifyEvidence(seed)[1],
      telemetry: {
        exposures: 0,
        qualified_clicks: 0,
        checkout_starts: 0,
        settled_payments: 0,
        fulfilled_orders: 0,
        verified_outcomes: 0,
        acquisition_cost_nzd: 0,
        fulfillment_cost_nzd: 0,
        human_touches: 0,
        time_to_fulfill: null,
        conversion: null,
        margin_nzd: null
      },
      authority: {
        external_action: 'BLOCKED',
        max_loss_nzd: 0,
        public_contact: false,
        live_financial_action: false,
        destructive_action: false
      },
      promotion_gate: 'VERIFIED_EXTERNAL_OUTCOME_REQUIRED',
      kill_gate: 'NO_QUALIFIED_DEMAND_OR_NO_FULFILLMENT_PROOF',
      replication: 'FORBIDDEN_UNTIL_VERIFIED',
      inventory_claim: 'NONE'
    };
  });

  return {
    status: 'READY_FOR_CUBE_GAUNTLET',
    phase: 'FIND_THE_HOLE',
    batch_size: variants.length,
    batch_rule: 'LAUNCH_IN_BATCHES_OF_5_OR_10',
    allocation_rule: 'TELEMETRY_SELECTS_TOP_1_OR_2; LOSERS_HOLD_OR_KILL; NO_REPLICATION_UNTIL_VERIFIED',
    source_substrate: 'ECONOMIC_SUBSTRATE',
    seed_opportunity_id: seed.opportunity_id || seed.candidate_id || null,
    seed_evidence_class: classifyEvidence(seed)[0],
    variants,
    telemetry: {
      ranking_fields: ['settled_payments','verified_outcomes','checkout_starts','qualified_clicks','exposures','acquisition_cost_nzd','fulfillment_cost_nzd','margin_nzd','human_touches','time_to_fulfill'],
      truth_rule: 'telemetry_does_not_equal_revenue',
      winner_rule: policy.promotion_rules?.WINNER || 'EXTERNAL_EVIDENCE_REQUIRED',
      clone_rule: 'ONLY_INDEPENDENTLY_VERIFIED_ECONOMIC_MECHANISMS_MAY_BE_REPLICATED',
      support_rule: 'SUPPORT_ONLY_TOP_1_OR_2_AFTER_OBSERVED_EVIDENCE'
    },
    cube_handoff: {
      state: 'DRAFT_INTERNAL_HANDOFF',
      registry_authority: 'SUPABASE_CUBE_SILO_REGISTRY',
      creation_gate: 'INTERNAL_AUTOMATION_ALLOWED',
      public_launch: 'BLOCKED',
      worker_roles: {
        cube: 'store silo identity, state, substrate, evidence and telemetry authority',
        swarm: 'explore bounded internal mutations',
        elohim: 'create/refine/repair internal proposals and scorecards',
        gauntlet: 'adversarially judge every Elohim output',
        truth_oracle: 'independently verify external economic evidence',
        beck_ledgers: 'immutable internal activity/economic-event record',
        local_supervisor: 'allocate available LM Studio capacity to reversible internal work only'
      }
    },
    external_action: 'NONE',
    replication_permission: seed.verification_status === 'VERIFIED' ? 1 : 0
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
          economic_evidence: assessEconomicEvidence(seed),
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

  const buyerSignalHunt = loadJson(BUYER_SIGNALS, { candidates: [], offer: {} });
  const buyerSignalOffer = buyerSignalHunt.offer || {};
  const approvedCatalog = loadJson(APPROVED, { approved: [] });
  const approvedIdentity = new Map((approvedCatalog.approved || []).map(x => [
    x.offer_id,
    { payment_link: x.payment_link_url || null, silo_id: x.silo || null, price_nzd: Number(x.price || 0) }
  ]));
  const buyerSignals = Array.isArray(buyerSignalHunt.candidates)
    ? buyerSignalHunt.candidates.map(x => ({
        candidate_id: x.candidate_id || null,
        title: x.title || null,
        buyer: x.buyer || x.target_buyer || 'PUBLICLY_OBSERVED_RELEVANT_HUMAN',
        offer: x.offer || x.proposed_offer || buyerSignalOffer.product_id || buyerSignalOffer.offer_id || null,
        price_nzd: Number(x.price_nzd || buyerSignalOffer.price_nzd || 0),
        observed_problem: x.observed_problem || x.problem || null,
        signal_terms: Array.isArray(x.signal_terms) ? x.signal_terms : [],
        surface: x.surface || x.channel || 'public_surface',
        url: x.url || null,
        offer_id: x.offer_id || buyerSignalOffer.offer_id || null,
        payment_link: x.payment_link || buyerSignalOffer.payment_link || null,
        payment_link_status: (x.payment_link || buyerSignalOffer.payment_link) ? 'CONFIGURED' : 'NOT_CONFIGURED',
        fulfillment_route: x.fulfillment_route || null,
        silo_id: x.silo_id || x.domain_id || approvedIdentity.get(x.offer_id || buyerSignalOffer.offer_id)?.silo_id || null,
        permission: x.permission || 'UNVERIFIED_SURFACE_RULES'
      }))
    : [];

  const buyerSignalQueue = buyerSignals
    .map(x => ({
      ...x,
      evidence_class: classifyEvidence(x)[0],
      evidence_priority: classifyEvidence(x)[1],
      economic_evidence: assessEconomicEvidence(x)
    }))
    .sort((a, b) => b.evidence_priority - a.evidence_priority || String(a.candidate_id).localeCompare(String(b.candidate_id)))
    .map((x, index) => ({
      ...x,
      queue_rank: index + 1
    }));

  const nextBuyerSignal = buyerSignalQueue.find(isActionableBuyerSignal) || null;
  // Public signals are Phase-1 inputs, not Phase-2 mechanisms. Evergreen only
  // receives a seed after an independent VERIFIED mechanism exists.
  const evergreenSeed = base.find(x => x.verification_status === 'VERIFIED') ||
    base.find(x => isActionableBuyerSignal(x)) ||
    base.find(x => ['EXISTING_B2B_OFFER_CANDIDATE','EXISTING_RECURRING_SURFACE','APPROVED_OFFER','LIVE_COMMERCE','PUBLIC_BUYER_SIGNAL','DISCOVERED_OPPORTUNITY'].includes(x.source_type)) ||
    base[0] || null;
  const evergreenExpansion = buildEvergreenExpansion(evergreenSeed);
  const golden_allocation = buildGoldenAllocation(rows);
  const modularFactories = buildModularFactories(loadJson(EVERGREEN_FACTORY, { live_adapters: [] }).live_adapters, evergreenSeed?.opportunity_id || evergreenSeed?.candidate_id || 'UNBOUND-SEED');
  const factory_factory = {
    schema_version: 'DREAMLEDGER/777/FACTORY-FACTORY/v1',
    status: 'READY_FOR_INTERNAL_CUBE_GAUNTLET',
    authority: 'ALLOCATION_ONLY',
    truth_authority: 'TRUTH_ORACLE',
    source_substrate: 'EVERGREEN_SILO_FACTORY',
    template_count: modularFactories.length,
    factory_instance_count: modularFactories.reduce((n, x) => n + x.instances.length, 0),
    factories: modularFactories,
    external_action: 'BLOCKED',
    replication: 'FORBIDDEN_UNTIL_INDEPENDENT_VERIFIED_OUTCOME'
  };
  evergreenExpansion.cube_handoff = {
    state: 'DRAFT_INTERNAL_HANDOFF',
    registry_authority: 'SUPABASE_CUBE_SILO_REGISTRY',
    creation_gate: 'HUMAN_APPROVAL_REQUIRED',
    public_launch: 'BLOCKED',
    variants: evergreenExpansion.variants.map(v => ({
      variant_id: v.variant_id,
      silo_slug: v.silo_slug,
      brand_name: v.brand_name,
      buyer_signal_binding: v.buyer_signal_binding,
      marketing_lane: v.marketing_lane,
      telemetry_schema: Object.keys(v.telemetry),
      promotion_gate: v.promotion_gate,
      kill_gate: v.kill_gate
    })),
    worker_roles: {
      cube: 'store silo identity, state, evidence and telemetry authority',
      swarm: 'rank bounded internal probes from observed evidence',
      elohim: 'produce internal deliverable/proposal only',
      gauntlet: 'adversarial qualification before promotion',
      truth_oracle: 'verify external evidence only',
      local_supervisor: 'allocate available LM Studio capacity to reversible internal work only'
    }
  };
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
  const nextVariant = evergreenExpansion.variants?.[0] || null;
  const acceptanceSignalId = nextBuyerSignal?.candidate_id || null;
  const acceptanceOfferId = nextBuyerSignal?.offer_id || null;
  const acceptancePaymentLink = nextBuyerSignal?.payment_link || nextVariant?.source_checkout_url || null;
  const acceptanceSiloId = nextBuyerSignal?.silo_id || nextVariant?.silo_slug || null;
  const acceptanceLaneId = EXPERIMENT_LANES[0].lane_id;
  const acceptanceExperimentId = acceptanceSignalId
    ? 'EXP-' + sha(JSON.stringify({ acceptanceSignalId, acceptanceLaneId, silo: acceptanceSiloId })).slice(0, 16).toUpperCase()
    : null;
  const acceptanceTelemetryId = acceptanceExperimentId
    ? 'TEL-' + sha(JSON.stringify({ acceptanceExperimentId, acceptanceSiloId })).slice(0, 16).toUpperCase()
    : null;
  const identity = acceptanceOfferId ? approvedIdentity.get(acceptanceOfferId) : null;
  const acceptanceAttribution = {
    offer_matches_payment: Boolean(identity && identity.payment_link && identity.payment_link === acceptancePaymentLink),
    candidate_matches_signal: Boolean(acceptanceSignalId),
    candidate_matches_silo: Boolean(acceptanceSignalId && acceptanceSiloId && identity && identity.silo_id === acceptanceSiloId)
  };
  const acceptanceContract = {
    status: 'LOCKED',
    phase: 'FIND_THE_HOLE',
    signal_id: acceptanceSignalId,
    observed_problem: nextBuyerSignal?.observed_problem || null,
    offer_id: acceptanceOfferId,
    price_nzd: Number(nextBuyerSignal?.price_nzd || nextVariant?.price_nzd || 0),
    payment_link: acceptancePaymentLink,
    silo_id: acceptanceSiloId,
    lane_id: acceptanceLaneId,
    experiment_id: acceptanceExperimentId,
    telemetry_id: acceptanceTelemetryId,
    attribution: acceptanceAttribution,
    human_gate: {
      external_action: 'REVIEW_AND_APPROVE_EXTERNAL_REPLY',
      send_status: 'NOT_SENT',
      approval_required: true
    },
    reality: {
      settled_payment: false,
      fulfillment: false,
      evidence: false,
      truth_status: 'UNVERIFIED'
    },
    expansion_permission: 0,
    disposition: 'HOLD_OR_KILL_NO_CLONE',
    mechanism_fossil: null
  };


  // Canonical Phase-1 -> Commerce handoff. Internal only. It carries
  // existing 777 identity into the existing commerce/fulfillment substrate.
  const approvedOffer = acceptanceOfferId ? (approvedCatalog.approved || []).find(x => x.offer_id === acceptanceOfferId) : null;
  const commerceHandoff = {
    schema_version: 'DREAMLEDGER/777/COMMERCE-HANDOFF/v1',
    handoff_id: acceptanceExperimentId ? '777-COMMERCE-' + acceptanceExperimentId : null,
    lifecycle_state: acceptanceSignalId && acceptanceOfferId && acceptancePaymentLink && acceptanceSiloId
      ? 'COMMERCE_READY'
      : 'COMMERCE_BLOCKED_MISSING_IDENTITY',
    signal_id: acceptanceSignalId,
    silo_id: acceptanceSiloId,
    cell_id: acceptanceExperimentId,
    experiment_id: acceptanceExperimentId,
    offer_id: acceptanceOfferId,
    lane_id: acceptanceLaneId,
    telemetry_id: acceptanceTelemetryId,
    price_nzd: Number(approvedOffer?.price || nextBuyerSignal?.price_nzd || 0),
    currency: approvedOffer?.currency || 'NZD',
    checkout_url: acceptancePaymentLink,
    payment_adapter: approvedOffer?.payment_adapter || 'stripe',
    fulfillment_contract: {
      route: approvedOffer?.fulfillment_route || nextBuyerSignal?.fulfillment_route || null,
      proof_of_delivery: approvedOffer?.proof_of_delivery || null,
      delivery_mechanism: approvedOffer?.delivery_mechanism || null
    },
    truth_contract: {
      required: ['real_external_buyer','settled_payment','correct_attribution','actual_fulfillment','durable_proof','independent_verification'],
      current_status: 'UNVERIFIED'
    },
    human_gate: { required: true, action: 'REVIEW_AND_APPROVE_EXTERNAL_REPLY', send_status: 'NOT_SENT' },
    external_action: 'BLOCKED_UNTIL_HUMAN_APPROVAL',
    reality: { checkout_observed: false, payment_settled: false, fulfillment_verified: false, external_evidence_verified: false, revenue_claimed_nzd: 0 },
    mechanism: { fossilized: false, expansion_permission: 0 }
  };

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
    economic_evidence_ladder: summarizeEvidenceLadder(base),
    activation_candidate_count: activation_candidates.length,
    activation_candidates,
    pricing_research: PRICING_RESEARCH,
    buyer_signal_count: buyerSignals.length,
    buyer_signal_queue: buyerSignalQueue,
    buyer_signal_gate: {
      eligible_count: buyerSignalQueue.filter(isActionableBuyerSignal).length,
      blocked_count: buyerSignalQueue.filter(x => !isActionableBuyerSignal(x)).length,
      rule: 'No buyer action without rung-one sourced evidence and explicit VERIFIED_PERMITTED surface status.',
      external_action_performed: false
    },
    next_human_action: nextHumanAction,
    acceptance_contract: acceptanceContract,
    commerce_handoff: commerceHandoff,
    evergreen_expansion: evergreenExpansion,
    golden_allocation,
    factory_factory,
    golden_contract: {
      purpose: 'CONCENTRATE_INTERNAL_COMPUTE_AND_ATTENTION_ON_HIGH-GRAVITY_ECONOMIC_OPPORTUNITIES',
      authority: 'ALLOCATION_ONLY',
      truth_authority: 'TRUTH_ORACLE',
      external_action: 'BLOCKED_UNTIL_EXISTING_AUTHORITY_AND_HUMAN_APPROVAL',
      replication: 'FORBIDDEN_UNTIL_INDEPENDENT_VERIFIED_OUTCOME',
      score_components: ['economic_value','evidence_proximity','commercial_readiness','buyer_specificity','repeatability']
    },
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

module.exports = { build, buildEvergreenExpansion, buildGoldenAllocation, goldenScore, LENSES, TRANSFORMS, GATES, EXPERIMENT_LANES };
