'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const outputs = [
  ['BEC-PRIME/compiler/FactoryFactoryCompiler.js', 'compile:factory-factory'],
  ['BEC-PRIME/compiler/FactoryFactoryApprovalPackets.js', 'compile:factory-approval']
];

function run() {
  const results = [];
  for (const [file, command] of outputs) {
    execFileSync('node', [path.join(ROOT, file)], { cwd: ROOT, stdio: 'pipe', env: process.env });
    results.push({ file, command, status: 'PASS' });
  }

  const queuePath = path.join(ROOT, 'BEC-PRIME/data/factory-factory/FACTORY-FACTORY-QUEUE.json');
  const packetPath = path.join(ROOT, 'BEC-PRIME/data/factory-factory/approval-packets/latest.json');
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  const packets = JSON.parse(fs.readFileSync(packetPath, 'utf8'));

  const exposureReady = (queue.queue || []).filter(x =>
    x.execution &&
    x.execution.external_action_required === true &&
    x.approval_required === true &&
    x.truth &&
    x.truth.revenue_claim_allowed === false
  );

  const manifest = {
    schema_version: 'DREAMLEDGER/FACTORY-FACTORY-RUN/v1',
    generated_at_utc: new Date().toISOString(),
    status: 'READY_FOR_AUTHORIZED_EXTERNAL_EXPERIMENTS',
    principle: 'Build candidates automatically; stop at the authority boundary; count only verified external outcomes.',
    compiled_queue: queue.queue || [],
    approval_packets: packets.packets || [],
    counts: {
      compiled: (queue.queue || []).length,
      approval_packets: (packets.packets || []).length,
      exposure_ready: exposureReady.length
    },
    authority_boundary: {
      discovery: 'AUTOMATIC',
      compilation: 'AUTOMATIC',
      approval_packet: 'AUTOMATIC',
      external_publication: 'APPROVAL_REQUIRED',
      external_spend: 'APPROVAL_REQUIRED',
      charging: 'APPROVAL_REQUIRED',
      revenue_claim: 'TRUTH_ORACLE_ONLY'
    },
    next_transition: exposureReady.length
      ? 'AUTHORIZE_ONE_APPROVED_ACQUISITION_EXPERIMENT'
      : 'DISCOVER_MORE_EVIDENCE_BACKED_CANDIDATES'
  };

  const out = path.join(ROOT, 'BEC-PRIME/data/factory-factory/latest-run.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };
