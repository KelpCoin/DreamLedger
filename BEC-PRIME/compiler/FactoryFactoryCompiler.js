'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'compiled', 'opportunities', 'ECONOMIC_GAUNTLET.json');
const OUT_DIR = path.join(ROOT, 'data', 'factory-factory');
const OUT = path.join(OUT_DIR, 'FACTORY-FACTORY-QUEUE.json');

function hash(v) {
  return crypto.createHash('sha256').update(v, 'utf8').digest('hex');
}

function compileCandidate(candidate) {
  const id = String(candidate.opportunity_id || '');
  const price = Number(candidate.price_nzd || 0);
  const testCost = Number(candidate.test_cost_nzd || 0);
  const buyer = candidate.buyer || null;
  const offer = candidate.offer || null;
  const smallestTest = candidate.smallest_test || null;

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
    economics: {
      test_cost_nzd: testCost,
      upside_nzd: Number(candidate.upside_nzd || 0),
      spend_allowed_without_authorization: false
    },
    execution: {
      acquisition_surface: candidate.channels || [],
      transaction_rail: 'existing commerce/Stripe rail where available',
      fulfillment: 'existing bounded fulfillment adapter or manual fulfillment',
      next_action: 'prepare approved exposure packet',
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
  const queue = candidates
    .filter(x => x.verdict === 'PASS')
    .map(compileCandidate);

  const payload = {
    schema_version: 'DREAMLEDGER/FACTORY-FACTORY-QUEUE/v1',
    generated_at_utc: new Date().toISOString(),
    compiler: 'FactoryFactoryCompiler',
    objective: 'compile evidence-backed demand into bounded monetization experiments using existing infrastructure',
    authority_boundary: {
      external_publication: 'APPROVAL_REQUIRED',
      external_spend: 'APPROVAL_REQUIRED',
      charging_customer: 'APPROVAL_REQUIRED',
      revenue_claim: 'TRUTH_ORACLE_ONLY'
    },
    source: path.relative(ROOT, source).replace(/\\/g, '/'),
    candidate_count: candidates.length,
    compiled_count: queue.length,
    queue,
    source_hash: hash(fs.readFileSync(source, 'utf8'))
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
    output: OUT,
    next: r.queue.slice(0, 5).map(x => ({
      experiment_id: x.experiment_id,
      opportunity_id: x.opportunity_id,
      title: x.title,
      state: x.state
    }))
  }, null, 2));
}

module.exports = { run, compileCandidate };
