'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { run: compileFactory } = require('../compiler/FactoryFactoryCompiler');

const ROOT = path.join(__dirname, '..');
const QUEUE = path.join(ROOT, 'data', 'factory-factory', 'FACTORY-FACTORY-QUEUE.json');
const OUT = path.join(ROOT, 'data', 'factory-factory', 'FACTORY-FACTORY-RUN.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function loadQueue() {
  if (!fs.existsSync(QUEUE)) compileFactory();
  return JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
}

function selectExperiments(queue, limit = 8) {
  return queue.queue
    .filter(x => x && x.state === 'COMPILED_AWAITING_AUTHORIZATION')
    .sort((a, b) => {
      const ap = Number(a.proposition?.price_nzd || 0);
      const bp = Number(b.proposition?.price_nzd || 0);
      const ac = Number(a.economics?.test_cost_nzd || 0);
      const bc = Number(b.economics?.test_cost_nzd || 0);
      return (bp - bc) - (ap - ac);
    })
    .slice(0, limit);
}

function buildRun(options = {}) {
  const queue = loadQueue();
  const selected = selectExperiments(queue, Number(options.limit || process.env.FACTORY_FACTORY_BATCH || 8));

  const run = {
    schema_version: 'DREAMLEDGER/FACTORY-FACTORY-RUN/v1',
    generated_at_utc: new Date().toISOString(),
    mode: 'BOUNDED_AUTONOMOUS_PREPARATION',
    objective: 'continuously compile evidence-backed commercial experiments while stopping at external authority boundaries',
    truth_rule: 'No internal artifact, checkout, publication, or simulated payment is revenue.',
    authority_boundary: {
      public_post: 'APPROVAL_REQUIRED',
      external_outreach: 'APPROVAL_REQUIRED',
      spend: 'APPROVAL_REQUIRED',
      charge: 'APPROVAL_REQUIRED',
      revenue_claim: 'TRUTH_ORACLE_ONLY'
    },
    source_queue_hash: sha256(JSON.stringify(queue)),
    selected_count: selected.length,
    selected: selected.map(x => ({
      experiment_id: x.experiment_id,
      opportunity_id: x.opportunity_id,
      silo: x.silo,
      title: x.title,
      buyer: x.demand?.buyer || null,
      offer: x.proposition?.offer || null,
      price_nzd: x.proposition?.price_nzd || 0,
      acquisition_surface: x.execution?.acquisition_surface || [],
      next_action: x.execution?.next_action || null,
      status: 'READY_FOR_AUTHORIZED_EXPOSURE'
    })),
    next_machine_action: selected.length ? 'prepare approval packet and await/consume explicit authorization' : 'refresh opportunity and approved-offer inputs',
    external_revenue: 'UNVERIFIED'
  };
  run.integrity_sha256 = sha256(JSON.stringify(run));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(run, null, 2) + '\n', 'utf8');
  return run;
}

if (require.main === module) {
  const r = buildRun();
  console.log(JSON.stringify({
    status: 'PASS',
    mode: r.mode,
    selected_count: r.selected_count,
    next_machine_action: r.next_machine_action,
    external_revenue: r.external_revenue,
    output: OUT
  }, null, 2));
}

module.exports = { buildRun, selectExperiments, loadQueue };
