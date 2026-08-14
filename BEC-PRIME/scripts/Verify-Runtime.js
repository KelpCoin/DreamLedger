'use strict';

const { verifyChain, EVENTS_FILE } = require('../runtime/Ledger');
const { verifyFossils, FOSSIL_FILE } = require('../runtime/Fossil');
const { advertisedWorkers } = require('../runtime/Scheduler');
const { listJobs } = require('../runtime/worker-pool');

const report = {
  schema_version: 'BEC-RUNTIME-VERIFY-1.0',
  checked_at: new Date().toISOString(),
  ledger: verifyChain(),
  fossils: verifyFossils(),
  workers: advertisedWorkers().workers.map(w => ({ worker_id: w.worker_id, availability: w.availability, trust_level: w.trust_level, models: w.models, permissions: w.permissions })),
  queue: { jobs: listJobs().length },
  paths: { events: EVENTS_FILE, fossils: FOSSIL_FILE }
};
report.status = report.ledger.status === 'PASS' && report.fossils.status === 'PASS' ? 'PASS' : 'FAIL';
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
