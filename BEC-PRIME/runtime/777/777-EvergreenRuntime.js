'use strict';

/**
 * 777 Evergreen Runtime Assembly
 *
 * Reassembles existing substrate into the already-authorized CUBE/Silo
 * experiment contract. It does not create a queue, ledger, Truth Oracle,
 * payment, buyer, or external authority.
 *
 * ECONOMIC SUBSTRATE -> CUBE/SILO -> SWARM -> ELOHIM -> GAUNTLET
 * -> AUTHORITY -> EXISTING COMMERCE -> TRUTH/BECK -> TELEMETRY -> EVERGREEN
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { run: runGauntlet } = require('../../gauntlet/CandidateGauntlet');

const ROOT = path.join(__dirname, '..', '..');
const EVERGREEN = path.join(ROOT, '..', 'public', 'evergreen-silo-factory.json');
const CUBE_REGISTRY = path.join(ROOT, 'cube', 'CUBE-SILO-REGISTRY.json');
const SCORECARD = path.join(ROOT, 'economic', 'ELOHIM_GAUNTLET_SCORECARD.json');

const sha = value => crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

function siloFor(source) {
  const slug = String(source?.slug || source?.id || '').toLowerCase();
  if (slug.includes('quote') || slug.includes('supplier') || slug.includes('freight')) return 'digital_products';
  return 'digital_products';
}

function elohimProposal(seed, variant, scorecard) {
  const capability = variant.source_capability || variant.source_capability_id || 'EXISTING_CAPABILITY';
  const offerId = variant.source_type === 'APPROVED_OFFER' ? capability : null;
  return {
    schema: 'DREAMLEDGER/ELOHIM_PROPOSAL/v1',
    created_by: 'ELOHIM',
    seed_opportunity_id: seed?.opportunity_id || seed?.candidate_id || null,
    variant_id: variant.variant_id,
    silo: siloFor({ slug: variant.source_capability }),
    offer_id: offerId,
    name: variant.brand_name || capability,
    problem: seed?.hypothesis || seed?.observed_problem || 'Economically interesting substrate requiring external validation.',
    target_buyer: seed?.buyer || 'UNVERIFIED_EXTERNAL_BUYER',
    deliverable: variant.offer_family || 'ECONOMIC_ANALYSIS',
    delivery_mechanism: variant.offer_family || 'EXISTING_FULFILLMENT_ROUTE',
    price: Number(variant.price_nzd || seed?.price_nzd || 49),
    currency: 'NZD',
    payment_adapter: 'stripe',
    checkout_route: variant.source_checkout_url || 'NOT_CONFIGURED',
    approval_required: true,
    checkout_available: false,
    status: 'ELOHIM_PROPOSAL_UNVERIFIED',
    proof_of_delivery: 'EXISTING_FULFILLMENT_EVIDENCE_REQUIRED',
    verification_rules: scorecard?.gauntlet?.checks || [],
    provenance: {
      private_material: 'excluded',
      source: '777_ECONOMIC_SUBSTRATE',
      seed_id: seed?.opportunity_id || seed?.candidate_id || null,
      variant_id: variant.variant_id
    },
    kill_condition: variant.kill_gate || 'NO_QUALIFIED_DEMAND_OR_NO_FULFILLMENT_PROOF',
    scorecard: {
      schema: scorecard?.schema || null,
      checks: scorecard?.gauntlet?.checks || [],
      verdicts: scorecard?.gauntlet?.verdicts || ['PASS','HOLD','KILL','CONTRADICTED'],
      promotion_rule: scorecard?.gauntlet?.promotion_rule || 'VERIFIED_EXTERNAL_OUTCOME_REQUIRED'
    },
    scorecard_schema: scorecard?.schema || null,
    external_action: 'BLOCKED',
    replication_permission: false
  };
}

function assemble(seed, variants = []) {
  const scorecard = readJson(SCORECARD, {});
  const registry = readJson(CUBE_REGISTRY, { silos: [] });
  const evergreen = readJson(EVERGREEN, { live_adapters: [], pain_vectors: [] });
  const proposals = variants.map(v => elohimProposal(seed, v, scorecard));
  const judged = proposals.map(proposal => {
    const proof = runGauntlet(proposal);
    return {
      variant_id: proposal.variant_id,
      proposal_id: 'ELOHIM-' + sha(proposal).slice(0, 20).toUpperCase(),
      silo_id: proposal.silo,
      elohim_status: proposal.status,
      gauntlet_verdict: proof.status,
      gauntlet_checks: proof.checks,
      candidate_hash: proof.candidate_hash,
      external_action: 'BLOCKED',
      replication_permission: false,
      truth_status: 'UNVERIFIED'
    };
  });

  const cells = judged.map((judgment, index) => ({
    cell_id: 'CELL-777-' + sha({
      seed: seed?.opportunity_id || seed?.candidate_id || null,
      variant_id: judgment.variant_id
    }).slice(0, 20).toUpperCase(),
    silo_id: judgment.silo_id,
    variant_number: index + 1,
    state: 'PROBING',
    substrate: {
      source: 'ECONOMICALLY_INTERESTING_SUBSTRATE',
      seed_opportunity_id: seed?.opportunity_id || seed?.candidate_id || null
    },
    gauntlet: judgment,
    telemetry: {
      exposures: 0,
      qualified_clicks: 0,
      checkout_starts: 0,
      settled_payments: 0,
      fulfilled_orders: 0,
      verified_outcomes: 0,
      human_touches: 0,
      acquisition_cost_nzd: 0,
      fulfillment_cost_nzd: 0,
      time_to_fulfill: null,
      margin_nzd: null
    },
    authority: {
      external_action: 'BLOCKED',
      publication: 'APPROVAL_REQUIRED',
      charging: 'BUYER_INITIATED_ONLY',
      spend: 'APPROVAL_REQUIRED'
    },
    replication: {
      permitted: false,
      gate: 'VERIFIED_EXTERNAL_OUTCOME_REQUIRED'
    }
  }));

  return {
    schema: 'DREAMLEDGER/777/EVERGREEN-RUNTIME-ASSEMBLY/v1',
    status: 'ASSEMBLED_INTERNAL_ONLY',
    generated_at_utc: new Date().toISOString(),
    source_substrate: {
      live_adapters: evergreen.live_adapters.length,
      pain_vectors: evergreen.pain_vectors.length
    },
    registry_authority: 'SUPABASE_CUBE_SILO_REGISTRY',
    registry_snapshot: registry.schema_version || null,
    elohim: {
      role: 'CREATE_REFINE_REPAIR_AND_PROPOSE_SCORECARDS',
      truth_authority: 'NONE'
    },
    gauntlet: {
      role: 'ADVERSARIAL_JUDGE_OF_ALL_ELOHIM_OUTPUT',
      scorecard_schema: scorecard.schema || null,
      judged_count: judged.length
    },
    cube: {
      role: 'PERSIST_CELL_IDENTITY_STATE_EVIDENCE_TELEMETRY',
      batch_rule: '5_OR_10',
      cells
    },
    supervisor: {
      compute_base: 'LM_STUDIO',
      allocation: 'AVAILABLE_GPU_TO_CUBE_AND_SWARM',
      authority: 'NONE',
      truth_authority: 'NONE'
    },
    truth_oracle: {
      role: 'PUBLIC_INDEPENDENT_ECONOMIC_TRUTH',
      verified_external_revenue_nzd: 0
    },
    beck: {
      role: 'IMMUTABLE_INTERNAL_ACTIVITY_AND_ECONOMIC_EVENT_LEDGER',
      mutation_by_runtime: 'NONE'
    },
    evergreen: {
      role: 'REPLICATE_ONLY_VERIFIED_MECHANISMS',
      replication_permission: false
    },
    persistence: {
      target: 'SUPABASE',
      status: 'PENDING_DATABASE_CONNECTION',
      no_fake_rows_written: true
    }
  };
}

module.exports = { assemble, elohimProposal };
