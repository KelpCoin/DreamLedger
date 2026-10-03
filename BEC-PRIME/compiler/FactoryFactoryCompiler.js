'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'compiled', 'opportunities', 'ECONOMIC_GAUNTLET.json');
const APPROVED_SOURCE = path.join(ROOT, 'catalog', 'offers', 'approved.json');
const SUBSTRATE_SOURCE = path.join(ROOT, '..', 'runtime', 'cube', 'substrate_inventory.json');

const LANE_MANIFEST_DIR = path.join(ROOT, '..', 'runtime', 'cube', 'manifests');
const OUT_DIR = path.join(ROOT, 'data', 'factory-factory');
const OUT = path.join(OUT_DIR, 'FACTORY-FACTORY-QUEUE.json');

function hash(v) {
  return crypto.createHash('sha256').update(v, 'utf8').digest('hex');
}

function inverseGauntlet(candidate) {
  const channels = Array.isArray(candidate.channels) ? candidate.channels.filter(Boolean) : [];
  const price = Number(candidate.price_nzd || 0);
  const buyer = candidate.buyer || null;
  const offer = candidate.offer || null;

  return {
    required_buyer: buyer,
    required_offer: offer,
    required_price_nzd: price,
    required_evidence: Array.isArray(candidate.evidence_required) ? candidate.evidence_required : [],
    required_proof: Array.isArray(candidate.proof_required) ? candidate.proof_required : [],
    transaction_conditions: {
      identifiable_external_buyer: true,
      settled_payment: true,
      correct_attribution: true,
      fulfillment: true,
      independent_proof: true
    },
    channel_constraints: channels.map(channel => ({
      channel,
      publication: 'APPROVAL_REQUIRED',
      transaction: 'APPROVAL_REQUIRED',
      truth_claim: 'TRUTH_ORACLE_ONLY'
    }))
  };
}

function invertCube(candidate) {
  const inverse = inverseGauntlet(candidate);
  const channels = inverse.channel_constraints.map(x => x.channel);
  return {
    search_target: 'Find opportunities whose observed demand can satisfy the inverse Gauntlet transaction conditions.',
    buyer: inverse.required_buyer,
    offer: inverse.required_offer,
    price_nzd: inverse.required_price_nzd,
    required_evidence: inverse.required_evidence,
    required_proof: inverse.required_proof,
    allowed_channels: channels,
    smallest_test: candidate.smallest_test || null,
    kill_condition: 'Do not expose externally unless buyer, offer, price, fulfillment, attribution, and truth requirements are explicit.',
    exposure_multiplier: Math.max(1, channels.length),
    expansion_rule: 'Replicate only the same bounded proposition across channels that independently permit it; never infer revenue from exposure.'
  };
}

function compileApprovedOffer(offer) {
  const price = Number(offer.price || 0);
  const channel = offer.acquisition_surface || 'discord';
  return {
    experiment_id: 'FFO-' + hash(JSON.stringify({
      offer_id: offer.offer_id,
      product_sku: offer.product_sku,
      payment_link_id: offer.payment_link_id
    })).slice(0, 16).toUpperCase(),
    opportunity_id: 'APPROVED-OFFER:' + offer.offer_id,
    silo: offer.silo || 'UNKNOWN',
    title: offer.name || offer.product_sku,
    state: 'COMPILED_AWAITING_AUTHORIZATION',
    demand: {
      buyer: offer.target_buyer || null,
      hypothesis: offer.problem || null,
      evidence_required: offer.verification_rules || []
    },
    proposition: {
      offer: offer.deliverable || offer.name || offer.product_sku,
      price_nzd: price,
      smallest_test: 'Publish exactly one approved offer through one authorized acquisition channel.'
    },
    inverse_gauntlet: {
      required_buyer: offer.target_buyer || null,
      required_offer: offer.name || offer.product_sku,
      required_price_nzd: price,
      required_evidence: offer.verification_rules || [],
      required_proof: [offer.proof_of_delivery || 'provider settlement + fulfillment evidence'],
      transaction_conditions: {
        identifiable_external_buyer: true,
        settled_payment: true,
        correct_attribution: true,
        fulfillment: true,
        independent_proof: true
      },
      channel_constraints: [{
        channel,
        publication: 'APPROVAL_REQUIRED',
        transaction: 'APPROVAL_REQUIRED',
        truth_claim: 'TRUTH_ORACLE_ONLY'
      }]
    },
    inverse_cube: {
      search_target: 'Find additional buyers for an already-approved offer without changing its proposition or truth boundary.',
      buyer: offer.target_buyer || null,
      offer: offer.name || offer.product_sku,
      price_nzd: price,
      required_evidence: offer.verification_rules || [],
      required_proof: [offer.proof_of_delivery || 'provider settlement + fulfillment evidence'],
      allowed_channels: [channel],
      smallest_test: 'One externally verified publication and settlement attempt.',
      kill_condition: 'Do not change price, promise, fulfillment, or truth claim without a new approval.',
      exposure_multiplier: 1,
      expansion_rule: 'Replicate only after an externally verified economic outcome.'
    },
    bidirectional_loop: {
      forward: 'APPROVED OFFER -> AUTHORITY -> EXPOSURE -> TRANSACTION -> SETTLEMENT -> FULFILLMENT -> TRUTH',
      reverse: 'TRANSACTION REQUIREMENTS -> INVERSE GAUNTLET -> INVERSE CUBE -> NEXT BUYER',
      join: 'Only approved offers with live payment rails become exposure-ready.'
    },
    economics: {
      test_cost_nzd: 0,
      upside_nzd: price,
      spend_allowed_without_authorization: false
    },
    execution: {
      acquisition_surface: [channel],
      transaction_rail: offer.payment_adapter || 'existing commerce rail',
      fulfillment: offer.fulfillment_route || 'manual fulfillment',
      next_action: 'prepare one authorized acquisition dispatch',
      external_action_required: true,
      approval_required: true
    },
    truth: {
      revenue_claim_allowed: false,
      verification_required: ['external_buyer', 'settled_payment', 'correct_attribution', 'fulfillment', 'independent_proof']
    },
    kill_conditions: [
      'payment link not live',
      'no identifiable buyer',
      'no settlement',
      'fulfillment failure',
      'independent proof unavailable',
      'contradictory evidence'
    ]
  };
}

function compileSubstrateLane(lane) {
  const laneId = String(lane.id || 'UNKNOWN-LANE');
  const price = Number(lane.price_nzd || 0);
  const surface = lane.current_surface || null;
  const proof = lane.proof || 'settled payment + fulfillment + independent proof';
  return {
    experiment_id: `FFS-${hash(JSON.stringify(lane)).slice(0,16).toUpperCase()}`,
    opportunity_id: `SUBSTRATE:${laneId}`,
    silo: laneId.split('_')[0] || 'UNKNOWN',
    title: laneId,
    state: 'COMPILED_AWAITING_AUTHORIZATION',
    demand: { buyer: lane.buyer || null, hypothesis: lane.hypothesis || null, evidence_required: lane.evidence_required || [] },
    proposition: {
      offer: lane.offer || laneId,
      price_nzd: price,
      smallest_test: lane.smallest_test || 'One authorized exposure and settlement attempt.'
    },
    inverse_gauntlet: {
      required_buyer: lane.buyer || null,
      required_offer: lane.offer || laneId,
      required_price_nzd: price,
      required_evidence: lane.evidence_required || [],
      required_proof: [proof],
      transaction_conditions: {
        identifiable_external_buyer: true,
        settled_payment: true,
        correct_attribution: true,
        fulfillment: true,
        independent_proof: true
      },
      channel_constraints: [{
        channel: surface || 'existing_authorized_surface',
        publication: 'APPROVAL_REQUIRED',
        transaction: 'APPROVAL_REQUIRED',
        truth_claim: 'TRUTH_ORACLE_ONLY'
      }]
    },
    inverse_cube: {
      search_target: 'Find qualified buyers for this existing substrate capability without changing its truth boundary.',
      buyer: lane.buyer || null,
      offer: lane.offer || laneId,
      price_nzd: price,
      required_evidence: lane.evidence_required || [],
      required_proof: [proof],
      allowed_channels: surface ? [surface] : [],
      smallest_test: lane.smallest_test || 'One authorized exposure and settlement attempt.',
      kill_condition: 'No transaction after the approved exposure window, or fulfillment/proof cannot be delivered.',
      exposure_multiplier: 1,
      expansion_rule: 'Replicate only after an externally verified economic outcome.'
    },
    bidirectional_loop: {
      forward: 'SUBSTRATE -> TRANSFORMATION -> GAUNTLET -> AUTHORITY -> EXPOSURE -> TRANSACTION -> TRUTH',
      reverse: 'TRANSACTION_REQUIREMENTS -> INVERSE_GAUNTLET -> INVERSE_CUBE -> SUBSTRATE_DISCOVERY',
      join: 'Existing substrate may become a test cell without becoming revenue.'
    },
    economics: { test_cost_nzd: 0, upside_nzd: price, spend_allowed_without_authorization: false },
    execution: {
      acquisition_surface: surface ? [surface] : [],
      transaction_rail: lane.rail || 'existing commerce rail',
      fulfillment: lane.rail || 'existing bounded fulfillment adapter',
      next_action: 'prepare one authorized exposure packet; no Stripe mutation is implied',
      external_action_required: true,
      approval_required: true
    },
    truth: {
      revenue_claim_allowed: false,
      verification_required: ['external_buyer','settled_payment','correct_attribution','fulfillment','independent_proof']
    },
    provenance: { source: 'runtime/cube/substrate_inventory.json', lane_id: laneId, source_refs: lane.source_refs || [] },
    kill_conditions: ['no identifiable buyer','no feasible fulfillment path','contradictory evidence','no transaction after approved exposure window']
  };
}


function compileLaneManifest(manifest, manifestPath) {
  const price = Number(manifest.commercial_boundary && manifest.commercial_boundary.price_nzd || 0);
  const transformation = manifest.transformation || {};
  const output = manifest.buyer_output || {};
  const commerce = manifest.commerce_path || {};
  const demandFamily = manifest.demand_family || 'economic_transformation';

  return {
    experiment_id: 'FFM-' + hash(JSON.stringify(manifest)).slice(0, 16).toUpperCase(),
    opportunity_id: 'LANE-MANIFEST:' + String(manifest.candidate_id || path.basename(manifestPath, '.json')),
    silo: String(manifest.substrate_type || 'UNKNOWN').split('_')[0] || 'UNKNOWN',
    title: transformation.name || manifest.candidate_id,
    state: 'COMPILED_AWAITING_AUTHORIZATION',
    structure: /match|compare|reconciliation|anomaly/i.test(demandFamily + ' ' + (transformation.name || '')) ? 'VERIFICATION' : 'SERVICE',
    demand_signal: demandFamily,
    buyer_class: null,
    offer_shape: output.format || transformation.name || 'bounded transformation',
    price_band: price,
    acquisition_surface: [],
    fulfillment_contract: commerce.fulfillment || 'existing bounded fulfillment adapter',
    truth_boundary: ['external_buyer','settled_payment','correct_attribution','fulfillment','independent_proof'],
    kill_conditions: Array.isArray(manifest.kill_criteria) ? manifest.kill_criteria : [],
    demand: {
      buyer: null,
      hypothesis: demandFamily + ' on ' + (manifest.substrate_type || 'unknown substrate'),
      evidence_required: Array.isArray(output.contains) ? output.contains : []
    },
    proposition: {
      offer: transformation.name || manifest.candidate_id,
      price_nzd: price,
      smallest_test: 'One authorized exposure and settlement attempt.'
    },
    inverse_gauntlet: {
      required_buyer: null,
      required_offer: transformation.name || manifest.candidate_id,
      required_price_nzd: price,
      required_evidence: Array.isArray(output.contains) ? output.contains : [],
      required_proof: commerce.proof ? [commerce.proof] : ['EXISTING_PROOF_SPINE'],
      transaction_conditions: {
        identifiable_external_buyer: true,
        settled_payment: true,
        correct_attribution: true,
        fulfillment: true,
        independent_proof: true
      },
      channel_constraints: [{
        channel: commerce.checkout || 'existing commerce boundary',
        publication: 'APPROVAL_REQUIRED',
        transaction: 'APPROVAL_REQUIRED',
        truth_claim: 'TRUTH_ORACLE_ONLY'
      }]
    },
    inverse_cube: {
      search_target: 'Find qualified buyers for the bounded lane without changing its substrate requirements or truth boundary.',
      buyer: null,
      offer: transformation.name || manifest.candidate_id,
      price_nzd: price,
      required_evidence: Array.isArray(output.contains) ? output.contains : [],
      required_proof: commerce.proof ? [commerce.proof] : ['EXISTING_PROOF_SPINE'],
      allowed_channels: [],
      smallest_test: 'One authorized exposure and settlement attempt.',
      kill_condition: 'Use the manifest kill criteria; no external exposure without authorization.',
      exposure_multiplier: 1,
      expansion_rule: 'Clone only after an independently verified external economic outcome.'
    },
    bidirectional_loop: {
      forward: 'SUBSTRATE -> TRANSFORMATION -> GAUNTLET -> AUTHORITY -> EXPOSURE -> TRANSACTION -> TRUTH',
      reverse: 'TRANSACTION_REQUIREMENTS -> INVERSE_GAUNTLET -> INVERSE_CUBE -> NEXT BUYER',
      join: 'Lane manifest is a candidate transformation, not economic proof.'
    },
    economics: {
      test_cost_nzd: 0,
      upside_nzd: price,
      spend_allowed_without_authorization: false
    },
    execution: {
      acquisition_surface: [],
      transaction_rail: commerce.checkout || 'existing commerce boundary',
      fulfillment: commerce.fulfillment || 'existing bounded fulfillment adapter',
      next_action: 'prepare candidate review packet; no Stripe mutation or external publication implied',
      external_action_required: true,
      approval_required: true
    },
    truth: {
      revenue_claim_allowed: false,
      verification_required: ['external_buyer','settled_payment','correct_attribution','fulfillment','independent_proof']
    },
    provenance: {
      source: path.relative(ROOT, manifestPath).replace(/\\/g, '/'),
      candidate_id: manifest.candidate_id || null,
      substrate_requirements: manifest.substrate_requirements || null
    }
  };
}

function readLaneManifests() {
  if (!fs.existsSync(LANE_MANIFEST_DIR)) return [];
  return fs.readdirSync(LANE_MANIFEST_DIR)
    .filter(name => name.endsWith('.json'))
    .map(name => {
      const full = path.join(LANE_MANIFEST_DIR, name);
      try {
        return compileLaneManifest(JSON.parse(fs.readFileSync(full, 'utf8')), full);
      } catch (error) {
        return {
          opportunity_id: 'LANE-MANIFEST-INVALID:' + name,
          title: name,
          state: 'INCOMPLETE',
          provenance: {
            source: path.relative(ROOT, full).replace(/\\/g, '/'),
            error: error.message
          }
        };
      }
    });
}

function compileCandidate(candidate) {
  const id = String(candidate.opportunity_id || '');
  const price = Number(candidate.price_nzd || 0);
  const testCost = Number(candidate.test_cost_nzd || 0);
  const buyer = candidate.buyer || null;
  const offer = candidate.offer || null;
  const smallestTest = candidate.smallest_test || null;
  const gauntletRequirements = inverseGauntlet(candidate);
  const cubeRequirements = invertCube(candidate);

  return {
    experiment_id: `FFX-${hash(JSON.stringify(candidate)).slice(0, 16).toUpperCase()}`,
    opportunity_id: id,
    silo: candidate.silo || 'UNKNOWN',
    title: candidate.title || id,
    state: 'COMPILED_AWAITING_AUTHORIZATION',
    demand: {
      buyer,
      hypothesis: candidate.hypothesis || null,
      evidence_required: candidate.evidence_required || []
    },
    proposition: {
      offer,
      price_nzd: price,
      smallest_test: smallestTest
    },
    inverse_gauntlet: gauntletRequirements,
    inverse_cube: cubeRequirements,
    bidirectional_loop: {
      forward: 'CUBE -> PROPOSITION -> GAUNTLET -> AUTHORITY -> EXPOSURE -> TRANSACTION -> TRUTH',
      reverse: 'TRANSACTION_REQUIREMENTS -> INVERSE_GAUNTLET -> INVERSE_CUBE -> CANDIDATE_DISCOVERY',
      join: 'Only candidates satisfying both directions become exposure-ready.'
    },
    economics: {
      test_cost_nzd: testCost,
      upside_nzd: Number(candidate.upside_nzd || 0),
      spend_allowed_without_authorization: false
    },
    execution: {
      acquisition_surface: candidate.channels || [],
      transaction_rail: 'existing commerce/Stripe rail where available',
      fulfillment: 'existing bounded fulfillment adapter or manual fulfillment',
      next_action: 'prepare approved exposure packet for each permitted channel',
      external_action_required: true,
      approval_required: true
    },
    truth: {
      revenue_claim_allowed: false,
      verification_required: [
        'external_buyer',
        'settled_payment',
        'correct_attribution',
        'fulfillment',
        'independent_proof'
      ]
    },
    kill_conditions: [
      'no identifiable buyer',
      'no feasible fulfillment path',
      'test cost exceeds available authorized budget',
      'contradictory evidence',
      'no transaction after approved exposure window'
    ]
  };
}

function run(options = {}) {
  const source = options.source || SOURCE;
  if (!fs.existsSync(source)) throw new Error(`Missing source: ${source}. Run npm run compile:opportunities first.`);
  const compiled = JSON.parse(fs.readFileSync(source, 'utf8'));
  const candidates = Array.isArray(compiled.results) ? compiled.results : [];
  const opportunityQueue = candidates
    .filter(x => x.verdict === 'PASS')
    .map(compileCandidate);
  const approvedDoc = fs.existsSync(APPROVED_SOURCE)
    ? JSON.parse(fs.readFileSync(APPROVED_SOURCE, 'utf8'))
    : { approved: [] };
  const approvedOffers = Array.isArray(approvedDoc.approved) ? approvedDoc.approved : [];
  const offerQueue = approvedOffers
    .filter(x => x.payment_link_url && x.payment_link_status === 'ACTIVE_LIVEMODE')
    .map(compileApprovedOffer);

  const substrateDoc = fs.existsSync(SUBSTRATE_SOURCE)
    ? JSON.parse(fs.readFileSync(SUBSTRATE_SOURCE, 'utf8'))
    : { money_lanes: [] };
  const substrateLanes = Array.isArray(substrateDoc.money_lanes) ? substrateDoc.money_lanes : [];
  const substrateQueue = substrateLanes.map(compileSubstrateLane);
  const laneManifestQueue = readLaneManifests();

  const seenOpportunityIds = new Set();
  const queue = [...offerQueue, ...opportunityQueue, ...substrateQueue, ...laneManifestQueue].filter(item => {
    if (seenOpportunityIds.has(item.opportunity_id)) return false;
    seenOpportunityIds.add(item.opportunity_id);
    return true;
  });

  const payload = {
    schema_version: 'DREAMLEDGER/FACTORY-FACTORY-QUEUE/v2',
    generated_at_utc: new Date().toISOString(),
    compiler: 'FactoryFactoryCompiler',
    objective: 'compile evidence-backed demand into bounded bidirectional monetization experiments using existing infrastructure',
    authority_boundary: {
      external_publication: 'APPROVAL_REQUIRED',
      external_spend: 'APPROVAL_REQUIRED',
      charging_customer: 'APPROVAL_REQUIRED',
      revenue_claim: 'TRUTH_ORACLE_ONLY'
    },
    loop: 'CUBE <-> INVERSE_GAUNTLET',
    source: path.relative(ROOT, source).replace(/\\/g, '/'),
    candidate_count: candidates.length,
    approved_offer_count: approvedOffers.length,
    compiled_opportunity_count: opportunityQueue.length,
    compiled_offer_count: offerQueue.length,
    compiled_substrate_count: substrateQueue.length,
    lane_manifest_count: laneManifestQueue.length,
    compiled_lane_manifest_count: laneManifestQueue.length,
    compiled_count: queue.length,
    queue,
    source_hash: hash(fs.readFileSync(source, 'utf8')),
    approved_source: path.relative(ROOT, APPROVED_SOURCE).replace(/\\\\/g, '/')
  };
  payload.integrity_sha256 = hash(JSON.stringify(payload));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return payload;
}

if (require.main === module) {
  const r = run();
  console.log(JSON.stringify({
    status: 'PASS',
    candidates: r.candidate_count,
    compiled: r.compiled_count,
    lane_manifests: r.lane_manifest_count,
    bidirectional_loop: r.loop,
    output: OUT,
    next: r.queue.slice(0, 5).map(x => ({
      experiment_id: x.experiment_id,
      opportunity_id: x.opportunity_id,
      title: x.title,
      state: x.state,
      exposure_surfaces: x.execution.acquisition_surface
    }))
  }, null, 2));
}

module.exports = { run, compileCandidate, compileApprovedOffer, compileLaneManifest, inverseGauntlet, invertCube };
