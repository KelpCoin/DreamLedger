'use strict';

const fs = require('fs');
const path = require('path');
const { verifyChain, EVENTS_FILE } = require('../runtime/Ledger');
const { verifyFossils, FOSSIL_FILE } = require('../runtime/Fossil');
const { advertisedWorkers } = require('../runtime/Scheduler');
const { listJobs } = require('../runtime/worker-pool');

const repo = path.resolve(__dirname, '..', '..');
const proofDir = path.join(repo, 'RUN-PROOFS');
const proofPath = path.join(proofDir, 'STAGE-1-LOGIC-GATE.json');

const ledger = verifyChain();
const fossils = verifyFossils();
const eventCount = Number(ledger.checked_events || 0);
const ledgerHeadHash = ledger.last_event_hash || null;
const lifecycleComplete = eventCount >= 7 && Boolean(ledgerHeadHash);
const status = ledger.status === 'PASS' && fossils.status === 'PASS' && lifecycleComplete ? 'PASS' : 'FAIL';

const report = {
  schema_version: 'BEC-STAGE-1-LOGIC-GATE-1.0',
  checked_at: new Date().toISOString(),
  status,
  gate: 'STAGE_1_LOGIC_GATE',
  mode: 'SIMULATION',
  verification_scope: 'runtime-ledger-and-fossil-integrity',
  lifecycle_required_events: 7,
  lifecycle_complete: lifecycleComplete,
  event_count: eventCount,
  ledger_head_hash: ledgerHeadHash,
  ledger: ledger,
  fossils: fossils,
  workers: advertisedWorkers().workers.map(w => ({
    worker_id: w.worker_id,
    availability: w.availability,
    trust_level: w.trust_level,
    models: w.models,
    permissions: w.permissions
  })),
  queue: { jobs: listJobs().length },
  paths: { events: EVENTS_FILE, fossils: FOSSIL_FILE },
  revenue_claimed: false,
  ra_000001_authorized: false
};

fs.mkdirSync(proofDir, { recursive: true });
fs.writeFileSync(proofPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
if (status !== 'PASS') process.exitCode = 1;
