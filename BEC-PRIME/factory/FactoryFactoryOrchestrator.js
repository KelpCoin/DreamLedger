'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { run: compileFactory } = require('../compiler/FactoryFactoryCompiler');
const { buildRun } = require('./FactoryFactory');

const ROOT = path.join(__dirname, '..');
const QUEUE = path.join(ROOT, 'data', 'factory-factory', 'FACTORY-FACTORY-QUEUE.json');
const OUTDIR = path.join(ROOT, 'data', 'factory-factory', 'orchestrator');
const CYCLE = path.join(ROOT, 'data', 'factory-factory', 'FACTORY-FACTORY-CYCLE.json');

function hash(v) {
  return crypto.createHash('sha256').update(v, 'utf8').digest('hex');
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (_) { return fallback; }
}

function buildAcquisitionPacket(experiment) {
  const channels = Array.isArray(experiment.acquisition?.channels)
    ? experiment.acquisition.channels.filter(Boolean)
    : [];
  return {
    packet_id: 'ACQ-' + experiment.experiment_id,
    schema_version: 'DREAMLEDGER/ACQUISITION-PACKET/v2',
    generated_at_utc: new Date().toISOString(),
    experiment_id: experiment.experiment_id,
    opportunity_id: experiment.opportunity_id,
    silo: experiment.silo || 'UNKNOWN',
    offer: {
      title: experiment.product?.offer || experiment.experiment_id,
      buyer: experiment.demand?.buyer || null,
      price_nzd: Number(experiment.product?.price_nzd || 0)
    },
    channel: channels,
    transaction: {
      rail: experiment.settlement?.rail || 'existing Stripe/commerce rail where configured',
      settlement_required: experiment.settlement?.settled_payment_required === true,
      attribution_required: experiment.settlement?.attribution_required === true
    },
    fulfillment: experiment.product?.fulfillment || 'existing bounded fulfillment or manual fulfillment',
    truth: {
      required: ['external_buyer','settled_payment','correct_attribution','fulfillment','independent_proof'],
      revenue_claim: 'TRUTH_ORACLE_ONLY'
    },
    authorization: {
      publication: 'APPROVAL_REQUIRED',
      outreach: 'APPROVAL_REQUIRED',
      spend: 'APPROVAL_REQUIRED',
      charge: 'APPROVAL_REQUIRED'
    },
    execution_state: 'READY_FOR_AUTHORIZED_EXTERNAL_ACTION'
  };
}

function run(options = {}) {
  compileFactory();
  const runState = buildRun({ limit: options.limit || process.env.FACTORY_FACTORY_BATCH || 16 });
  const queue = readJson(QUEUE, { queue: [] });
  const selected = Array.isArray(runState.selected) ? runState.selected : [];

  const packets = selected.map(buildAcquisitionPacket);
  const byExperiment = Object.fromEntries(packets.map(p => [p.experiment_id, p]));

  const output = {
    schema_version: 'DREAMLEDGER/FACTORY-FACTORY-ORCHESTRATOR/v1',
    generated_at_utc: new Date().toISOString(),
    mode: 'BOUNDED_AUTONOMOUS_ECONOMIC_PREPARATION',
    objective: 'turn approved/evidence-backed inputs into repeatable, authorization-gated acquisition cells',
    source_queue_hash: hash(JSON.stringify(queue)),
    selected_count: selected.length,
    acquisition_packet_count: packets.length,
    selected,
    acquisition_packets: byExperiment,
    state_machine: [
      'DISCOVERED','NORMALIZED','EVIDENCED','QUALIFIED','OFFERABLE',
      'AUTHORIZED','EXECUTING','EXTERNAL_EFFECT','PAYMENT_PENDING',
      'SETTLED','FULFILLING','FULFILLED','VERIFIED','BUSINESS_TRUTH',
      'LEARNED','REPLICABLE'
    ],
    terminal_states: ['STALE','CONTRADICTED','FAILED','REJECTED','QUARANTINED'],
    invariants: [
      'No buyer is invented.',
      'No payment is invented.',
      'No revenue is inferred from internal activity.',
      'No external publication occurs from this process.',
      'No spend occurs from this process.',
      'No charge occurs from this process.',
      'Replication requires verified external economic evidence.'
    ],
    next_transition: selected.length
      ? 'AUTHORITY: execute only an explicitly authorized acquisition packet'
      : 'DISCOVERY: refresh evidence-backed opportunity inputs'
  };

  output.integrity_sha256 = hash(JSON.stringify(output));
  const cycle = {
    schema_version: 'DREAMLEDGER/FACTORY-FACTORY-CYCLE/v1',
    generated_at_utc: output.generated_at_utc,
    selected_count: selected.length,
    selected_experiments: selected.map(x => x.experiment_id),
    external_action: 'NOT_PERFORMED',
    external_revenue: 'UNVERIFIED',
    business_truth: 'NOT_CLAIMED',
    next_transition: output.next_transition,
    source_queue_hash: output.source_queue_hash,
    orchestrator_integrity_sha256: output.integrity_sha256
  };
  cycle.integrity_sha256 = hash(JSON.stringify(cycle));
  fs.mkdirSync(OUTDIR, { recursive: true });
  fs.writeFileSync(path.join(OUTDIR, 'latest.json'), JSON.stringify(output, null, 2) + '\n');
  fs.writeFileSync(CYCLE, JSON.stringify(cycle, null, 2) + '\n');
  for (const p of packets) {
    fs.writeFileSync(path.join(OUTDIR, p.packet_id + '.json'), JSON.stringify(p, null, 2) + '\n');
  }
  return output;
}

if (require.main === module) {
  const r = run();
  console.log(JSON.stringify({
    status: 'PASS',
    selected_count: r.selected_count,
    acquisition_packet_count: r.acquisition_packet_count,
    next_transition: r.next_transition,
    output: path.join(OUTDIR, 'latest.json')
  }, null, 2));
}

module.exports = { run, buildAcquisitionPacket };
