'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { run: compileFactory } = require('../compiler/FactoryFactoryCompiler');

const ROOT = path.join(__dirname, '..');
const QUEUE = path.join(ROOT, 'data', 'factory-factory', 'FACTORY-FACTORY-QUEUE.json');
const OUT_DIR = path.join(ROOT, 'data', 'factory-factory');
const OUT = path.join(OUT_DIR, 'FACTORY-FACTORY-RUN.json');
const CELLS = path.join(OUT_DIR, 'MONEY-CELLS.json');

const sha256 = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

function loadQueue() {
  if (!fs.existsSync(QUEUE)) compileFactory();
  return JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
}

function evidenceRank(x) {
  const buyer = x?.demand?.buyer ? 3 : 0;
  const offer = x?.proposition?.offer ? 3 : 0;
  const price = Number(x?.proposition?.price_nzd || 0) > 0 ? 2 : 0;
  const channel = Array.isArray(x?.execution?.acquisition_surface) && x.execution.acquisition_surface.length ? 2 : 0;
  const cost = Number(x?.economics?.test_cost_nzd || 0) === 0 ? 2 : 0;
  const truth = Array.isArray(x?.truth?.verification_required) ? 2 : 0;
  return buyer + offer + price + channel + cost + truth;
}

function selectFactories(queue, limit = 12) {
  return (queue.queue || [])
    .filter(x => x && x.state === 'COMPILED_AWAITING_AUTHORIZATION')
    .sort((a, b) => evidenceRank(b) - evidenceRank(a))
    .slice(0, limit);
}

function buildMoneyCell(x) {
  const price = Number(x.proposition?.price_nzd || 0);
  const channels = Array.isArray(x.execution?.acquisition_surface)
    ? x.execution.acquisition_surface.filter(Boolean)
    : [];

  return {
    cell_id: 'CELL-' + sha256(JSON.stringify({
      experiment_id: x.experiment_id,
      offer: x.proposition?.offer,
      price,
      channels
    })).slice(0, 20).toUpperCase(),
    experiment_id: x.experiment_id,
    opportunity_id: x.opportunity_id,
    silo: x.silo,
    state: 'READY_FOR_AUTHORIZED_ACQUISITION',
    demand: {
      buyer: x.demand?.buyer || null,
      hypothesis: x.demand?.hypothesis || null,
      evidence_required: x.demand?.evidence_required || []
    },
    product: {
      offer: x.proposition?.offer || null,
      price_nzd: price,
      fulfillment: x.execution?.fulfillment || null
    },
    acquisition: {
      channels,
      smallest_test: x.proposition?.smallest_test || null,
      external_action: 'APPROVAL_REQUIRED',
      allowed_rail: 'configured acquisition rail only'
    },
    settlement: {
      rail: x.execution?.transaction_rail || 'configured commerce rail',
      attribution_required: true,
      settled_payment_required: true
    },
    truth: {
      required: x.truth?.verification_required || [
        'external_buyer',
        'settled_payment',
        'correct_attribution',
        'fulfillment',
        'independent_proof'
      ],
      revenue_state: 'UNVERIFIED',
      business_truth: 'NOT_CLAIMED'
    },
    replication: {
      trigger: 'one externally verified economic event',
      clone_rule: 'replicate only the demonstrated proposition, channel, fulfillment and unit economics',
      maximum_initial_clones: 3
    },
    kill: [
      'no identifiable buyer',
      'payment rail unavailable',
      'fulfillment failure',
      'attribution failure',
      'contradictory evidence',
      'no external response within approved experiment window'
    ]
  };
}

function buildRun(options = {}) {
  const queue = loadQueue();
  const limit = Number(options.limit || process.env.FACTORY_FACTORY_BATCH || 12);
  const selected = selectFactories(queue, limit);
  const cells = selected.map(buildMoneyCell);

  const run = {
    schema_version: 'DREAMLEDGER/FACTORY-FACTORY-RUN/v2',
    generated_at_utc: new Date().toISOString(),
    mode: 'CONTINUOUS_FACTORY_COMPILATION',
    objective: 'turn evidence-backed opportunities and approved offers into bounded, repeatable money cells without fabricating demand or crossing authority boundaries',
    economic_truth: {
      external_buyer: false,
      settled_payment: false,
      correct_attribution: false,
      fulfillment: false,
      independent_proof: false,
      revenue_claim: 'UNVERIFIED'
    },
    authority_boundary: {
      public_post: 'APPROVAL_REQUIRED',
      external_outreach: 'APPROVAL_REQUIRED',
      spend: 'APPROVAL_REQUIRED',
      charge: 'APPROVAL_REQUIRED',
      production_commerce_mutation: 'APPROVAL_REQUIRED',
      revenue_claim: 'TRUTH_ORACLE_ONLY'
    },
    factory: {
      input: 'CUBE opportunities + approved live offers',
      transform: 'Gauntlet constraints + inverse Cube requirements + settlement/fulfillment/truth contracts',
      output: 'money cells + approval packets',
      replication_gate: 'independently verified external economic event'
    },
    source_queue_hash: sha256(JSON.stringify(queue)),
    selected_count: selected.length,
    cells,
    next_machine_action: cells.length
      ? 'compile acquisition packets, reconcile live settlement state, and await/consume explicit external-action authorization'
      : 'refresh opportunity and approved-offer inputs',
    external_action: 'NOT_PERFORMED',
    external_revenue: 'UNVERIFIED',
    business_truth: 'NOT_CLAIMED'
  };

  run.integrity_sha256 = sha256(JSON.stringify(run));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(run, null, 2) + '\n', 'utf8');
  fs.writeFileSync(CELLS, JSON.stringify({
    schema_version: 'DREAMLEDGER/MONEY-CELLS/v1',
    generated_at_utc: run.generated_at_utc,
    cell_count: cells.length,
    cells,
    integrity_sha256: sha256(JSON.stringify(cells))
  }, null, 2) + '\n', 'utf8');

  return run;
}

if (require.main === module) {
  const r = buildRun();
  console.log(JSON.stringify({
    status: 'PASS',
    mode: r.mode,
    selected_count: r.selected_count,
    cells: r.cells.map(x => ({
      cell_id: x.cell_id,
      experiment_id: x.experiment_id,
      price_nzd: x.product.price_nzd,
      channels: x.acquisition.channels
    })),
    external_action: r.external_action,
    external_revenue: r.external_revenue,
    output: OUT
  }, null, 2));
}

module.exports = { buildRun, selectFactories, buildMoneyCell, loadQueue };
