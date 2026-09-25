'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const FACTORY_DIR = path.join(ROOT, 'data', 'factory-factory');
const INPUT = path.join(FACTORY_DIR, 'VERIFIED-MECHANISMS.json');
const OUT = path.join(FACTORY_DIR, 'REPLICATION-QUEUE.json');

const sha256 = v => crypto.createHash('sha256').update(v, 'utf8').digest('hex');

function loadVerifiedMechanisms() {
  if (!fs.existsSync(INPUT)) {
    return {
      schema_version: 'DREAMLEDGER/VERIFIED-MECHANISMS/v1',
      mechanisms: []
    };
  }
  return JSON.parse(fs.readFileSync(INPUT, 'utf8'));
}

function isReplicable(m) {
  return Boolean(
    m &&
    m.truth_status === 'VERIFIED' &&
    m.external_buyer === true &&
    m.settled_payment === true &&
    m.correct_attribution === true &&
    m.fulfillment === true &&
    m.independent_proof === true &&
    m.proposition &&
    m.channel &&
    m.unit_economics
  );
}

function compileReplication(m) {
  const base = {
    mechanism_id: m.mechanism_id,
    source_cell_id: m.cell_id,
    state: 'REPLICATION_AUTHORIZATION_REQUIRED',
    source: {
      proposition: m.proposition,
      channel: m.channel,
      fulfillment: m.fulfillment_route,
      unit_economics: m.unit_economics
    },
    replication: {
      rule: 'Clone only demonstrated behavior. Do not infer demand, price, buyer, margin or truth from similarity.',
      initial_clone_limit: 3,
      clones: [],
      required_authority: 'APPROVAL_REQUIRED'
    },
    truth: {
      source_status: 'VERIFIED',
      clone_status: 'UNVERIFIED_UNTIL_INDEPENDENT_TRANSACTION'
    }
  };

  base.integrity_sha256 = sha256(JSON.stringify(base));
  return base;
}

function run() {
  const source = loadVerifiedMechanisms();
  const mechanisms = Array.isArray(source.mechanisms) ? source.mechanisms : [];
  const eligible = mechanisms.filter(isReplicable);
  const rejected = mechanisms
    .filter(m => !isReplicable(m))
    .map(m => ({
      mechanism_id: m?.mechanism_id || null,
      reason: 'Truth gate not satisfied. No replication permitted.'
    }));

  const queue = {
    schema_version: 'DREAMLEDGER/REPLICATION-QUEUE/v1',
    generated_at_utc: new Date().toISOString(),
    rule: 'NO_VERIFIED_TRANSACTION_NO_CLONING',
    source_count: mechanisms.length,
    eligible_count: eligible.length,
    rejected_count: rejected.length,
    eligible: eligible.map(compileReplication),
    rejected,
    authority_boundary: {
      clone_generation: 'PREPARE_ONLY',
      external_publication: 'APPROVAL_REQUIRED',
      spend: 'APPROVAL_REQUIRED',
      charging: 'APPROVAL_REQUIRED',
      truth_claim: 'TRUTH_ORACLE_ONLY'
    }
  };

  queue.integrity_sha256 = sha256(JSON.stringify(queue));
  fs.mkdirSync(FACTORY_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(queue, null, 2) + '\n', 'utf8');
  return queue;
}

if (require.main === module) {
  const r = run();
  console.log(JSON.stringify({
    status: 'PASS',
    rule: r.rule,
    source_count: r.source_count,
    eligible_count: r.eligible_count,
    rejected_count: r.rejected_count,
    output: OUT
  }, null, 2));
}

module.exports = { run, isReplicable, compileReplication, loadVerifiedMechanisms };
