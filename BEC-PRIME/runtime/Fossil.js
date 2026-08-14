'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sha256 } = require('./Ledger');

const ROOT = path.join(__dirname, '..');
const PROOF_DIR = path.resolve(process.env.BEC_PROOF_DIR || path.join(ROOT, 'data', 'proofs'));
const FOSSIL_DIR = path.join(PROOF_DIR, 'fossils');
const FOSSIL_FILE = path.join(FOSSIL_DIR, 'FOSSIL_CHAIN.jsonl');
fs.mkdirSync(FOSSIL_DIR, { recursive: true });

function lastFossilHash() {
  if (!fs.existsSync(FOSSIL_FILE)) return null;
  const lines = fs.readFileSync(FOSSIL_FILE, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.length ? JSON.parse(lines[lines.length - 1]).fossil_hash || null : null;
}

function createFossil(input) {
  const fossil = {
    schema_version: 'BEC-FOSSIL-1.0',
    fossil_id: `fossil_${new Date().toISOString().replace(/[-:.TZ]/g, '')}_${crypto.randomBytes(4).toString('hex')}`,
    previous_fossil_hash: lastFossilHash(),
    timestamp: new Date().toISOString(),
    graph_id: input.graph_id || 'BEC-RUNTIME',
    branch_id: input.job_id || 'runtime',
    trigger_event_id: input.trigger_event_id || null,
    event_window: input.event_window || {},
    manifest_hash: input.manifest_hash || null,
    worker: input.worker || null,
    claims: input.claims || { payment_claim: false, sale_claim: false, fulfillment_claim: false },
    result: input.result || 'PASS'
  };
  fossil.fossil_hash = `sha256:${sha256(fossil)}`;
  fs.appendFileSync(FOSSIL_FILE, JSON.stringify(fossil) + '\n', 'utf8');
  return fossil;
}

function verifyFossils() {
  if (!fs.existsSync(FOSSIL_FILE)) return { status: 'PASS', checked_fossils: 0, last_fossil_hash: null, failures: [] };
  const fossils = fs.readFileSync(FOSSIL_FILE, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  let previous = null;
  const failures = [];
  for (let i = 0; i < fossils.length; i += 1) {
    const item = fossils[i];
    if (item.previous_fossil_hash !== previous) failures.push(`fossil ${i + 1}: previous_fossil_hash mismatch`);
    const body = { ...item };
    delete body.fossil_hash;
    if (`sha256:${sha256(body)}` !== item.fossil_hash) failures.push(`fossil ${i + 1}: fossil_hash mismatch`);
    previous = item.fossil_hash;
  }
  return { status: failures.length ? 'FAIL' : 'PASS', checked_fossils: fossils.length, last_fossil_hash: previous, failures };
}

module.exports = { createFossil, verifyFossils, FOSSIL_FILE };
