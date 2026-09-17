#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG = Object.freeze({
  refinementDir: path.join(ROOT, 'BEC-PRIME', 'data', 'refinement'),
  queueDir: path.join(ROOT, '.promotion', 'queue'),
  receiptsDir: path.join(ROOT, '.promotion'),
  compilerOutDir: path.join(ROOT, 'BEC-PRIME', 'compiled', 'website'),
  cooldownMs: 24 * 60 * 60 * 1000,
  validSilos: ['dreamledger', 'amplissa', 'phinhaven'],
  compilerCmd: ['npm', 'run', 'compile']
});

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function sha256File(file) { return sha256(fs.readFileSync(file)); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}
function safeRunId(runId) {
  if (!runId || !/^RUN-[A-Za-z0-9._-]+$/.test(runId)) throw new Error(`invalid run id: ${runId}`);
  return runId;
}
function runDir(runId) { return path.join(CONFIG.refinementDir, safeRunId(runId)); }
function queuePath(runId) { return path.join(CONFIG.queueDir, `${safeRunId(runId)}.json`); }
function receiptPath(runId, kind) { return path.join(CONFIG.receiptsDir, `${safeRunId(runId)}.${kind}.json`); }

function readRunResult(runId) {
  const id = safeRunId(runId);
  const dir = runDir(id);
  const resultPath = path.join(dir, 'RESULT.json');
  const candidatePath = path.join(dir, 'candidate.json');
  const gauntletPath = path.join(dir, 'GAUNTLET-PROOF.json');
  for (const file of [resultPath, candidatePath, gauntletPath]) {
    if (!fs.existsSync(file)) throw new Error(`required promotion evidence missing: ${file}`);
  }
  const result = readJson(resultPath);
  const candidate = readJson(candidatePath);
  const gauntlet = readJson(gauntletPath);
  if (result.run_id && result.run_id !== id) throw new Error(`RESULT run_id mismatch: ${result.run_id}`);
  if (result.status !== 'READY_FOR_APPROVAL') throw new Error(`run ${id} is ${result.status}, not READY_FOR_APPROVAL`);
  if (gauntlet.status !== 'PASS') throw new Error(`run ${id} has a non-passing Gauntlet proof`);
  const candidateSha = sha256(canonical(candidate));
  if (gauntlet.candidate_hash && gauntlet.candidate_hash !== candidateSha) throw new Error(`candidate hash mismatch for ${id}`);
  return { runId: id, dir, resultPath, candidatePath, gauntletPath, result, candidate, gauntlet,
    resultSha256: sha256File(resultPath), candidateSha256: candidateSha, gauntletSha256: sha256File(gauntletPath) };
}

function artifactTree(dir) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  function walk(current, prefix) {
    for (const name of fs.readdirSync(current).sort()) {
      const full = path.join(current, name);
      const rel = prefix ? path.join(prefix, name) : name;
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full, rel);
      else if (stat.isFile()) out[rel.replace(/\\/g, '/')] = sha256File(full);
    }
  }
  walk(dir, '');
  return out;
}
function treeDigest(tree) { return sha256(canonical(tree)); }
function assertKillSwitchOff() {
  if (process.env.PROMOTION_KILL_SWITCH !== 'OFF') {
    throw new Error('PROMOTION_KILL_SWITCH is not OFF. Promotion is fail-closed.');
  }
}

function cmdQueue(runId) {
  const run = readRunResult(runId);
  const silo = run.candidate.silo;
  if (!CONFIG.validSilos.includes(silo)) throw new Error(`invalid silo: ${silo}`);
  const file = queuePath(run.runId);
  if (fs.existsSync(file)) {
    const existing = readJson(file);
    if (existing.candidate_sha256 !== run.candidateSha256 || existing.result_sha256 !== run.resultSha256 || existing.gauntlet_sha256 !== run.gauntletSha256) {
      throw new Error(`existing queue entry for ${run.runId} does not match source evidence`);
    }
    console.log(JSON.stringify(existing, null, 2));
    return existing;
  }
  const now = new Date();
  const queue = {
    schema: 'dreamledger-promotion-queue/v2',
    run_id: run.runId,
    state: 'QUEUED',
    silo,
    candidate_path: path.relative(ROOT, run.candidatePath).replace(/\\/g, '/'),
    result_path: path.relative(ROOT, run.resultPath).replace(/\\/g, '/'),
    gauntlet_path: path.relative(ROOT, run.gauntletPath).replace(/\\/g, '/'),
    candidate_sha256: run.candidateSha256,
    result_sha256: run.resultSha256,
    gauntlet_sha256: run.gauntletSha256,
    queued_at: now.toISOString(),
    ready_at: new Date(now.getTime() + CONFIG.cooldownMs).toISOString(),
    public_execution: 'BLOCKED_UNTIL_HUMAN_APPROVAL',
    kill_switch_required: 'OFF'
  };
  writeJson(file, queue);
  console.log(JSON.stringify(queue, null, 2));
  return queue;
}

function revalidateQueue(entry) {
  const run = readRunResult(entry.run_id);
  if (entry.candidate_sha256 !== run.candidateSha256 || entry.result_sha256 !== run.resultSha256 || entry.gauntlet_sha256 !== run.gauntletSha256) {
    throw new Error(`source evidence changed after queueing ${entry.run_id}`);
  }
  if (entry.silo !== run.candidate.silo) throw new Error(`silo changed after queueing ${entry.run_id}`);
  return run;
}

function cmdApprove(runId, keyPath) {
  const entry = readJson(queuePath(runId));
  if (entry.state !== 'QUEUED' && entry.state !== 'READY_FOR_APPROVAL') throw new Error(`queue entry is ${entry.state}, not approvable`);
  if (Date.parse(entry.ready_at) > Date.now()) throw new Error(`cool-off not elapsed; ready_at=${entry.ready_at}`);
  if (!fs.existsSync(keyPath)) throw new Error(`private key not found: ${keyPath}`);
  const run = revalidateQueue(entry);
  const privateKey = crypto.createPrivateKey(fs.readFileSync(keyPath, 'utf8'));
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('promotion key must be Ed25519');
  const receipt = {
    schema_version: '1.0', queue_id: run.runId, silo: entry.silo,
    candidate_sha256: run.candidateSha256, result_sha256: run.resultSha256, gauntlet_sha256: run.gauntletSha256,
    approved_by: process.env.PROMOTION_APPROVER || process.env.GITHUB_ACTOR || process.env.USER || process.env.USERNAME || 'unknown',
    approved_at: new Date().toISOString(), approval_scope: `Compile and deploy ${run.runId} to silo ${entry.silo}.`, revocable: false
  };
  const signature = crypto.sign(null, Buffer.from(canonical(receipt)), privateKey).toString('base64');
  receipt.signature = signature;
  receipt.signature_algorithm = 'Ed25519';
  writeJson(receiptPath(runId, 'approval'), receipt);
  entry.state = 'APPROVED'; entry.approved_at = receipt.approved_at; entry.approval_receipt = path.relative(ROOT, receiptPath(runId, 'approval')).replace(/\\/g, '/');
  writeJson(queuePath(runId), entry);
}

function cmdCompile(runId) {
  assertKillSwitchOff();
  const entry = readJson(queuePath(runId));
  if (entry.state !== 'APPROVED') throw new Error(`queue entry is ${entry.state}, not APPROVED`);
  const run = revalidateQueue(entry);
  const approval = readJson(receiptPath(runId, 'approval'));
  if (!approval.signature || approval.candidate_sha256 !== run.candidateSha256 || approval.result_sha256 !== run.resultSha256 || approval.gauntlet_sha256 !== run.gauntletSha256) throw new Error('approval receipt does not bind to current evidence');
  const publicKeyPath = process.env.PROMOTION_PUBLIC_KEY;
  if (publicKeyPath && fs.existsSync(publicKeyPath)) {
    const publicKey = crypto.createPublicKey(fs.readFileSync(publicKeyPath, 'utf8'));
    const payload = { ...approval }; delete payload.signature;
    if (!crypto.verify(null, Buffer.from(canonical(payload)), publicKey, Buffer.from(approval.signature, 'base64'))) throw new Error('approval signature verification failed');
  }
  const [cmd, ...args] = CONFIG.compilerCmd;
  execFileSync(cmd, args, { stdio: 'inherit', env: { ...process.env, PROMOTION_QUEUE_ID: runId, PROMOTION_SILO: entry.silo } });
  const tree = artifactTree(CONFIG.compilerOutDir);
  if (!Object.keys(tree).length) throw new Error(`compiler produced no files at ${CONFIG.compilerOutDir}`);
  const compile = { schema: 'dreamledger-compile-receipt/v2', queue_id: runId, silo: entry.silo, compiled_at: new Date().toISOString(), output_dir: path.relative(ROOT, CONFIG.compilerOutDir).replace(/\\/g, '/'), compiler_cmd: CONFIG.compilerCmd.join(' '), candidate_sha256: run.candidateSha256, result_sha256: run.resultSha256, gauntlet_sha256: run.gauntletSha256, artifact_tree: tree, artifact_tree_sha256: treeDigest(tree) };
  writeJson(receiptPath(runId, 'compile'), compile);
  entry.state = 'COMPILED'; entry.compiled_at = compile.compiled_at; entry.compile_receipt = path.relative(ROOT, receiptPath(runId, 'compile')).replace(/\\/g, '/'); writeJson(queuePath(runId), entry);
}

function cmdSign(runId, keyPath) {
  assertKillSwitchOff();
  const receiptFile = receiptPath(runId, 'compile');
  const receipt = readJson(receiptFile);
  const key = crypto.createPrivateKey(fs.readFileSync(keyPath, 'utf8'));
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('promotion key must be Ed25519');
  const payload = { ...receipt }; delete payload.signature; delete payload.signature_algorithm;
  receipt.signature = crypto.sign(null, Buffer.from(canonical(payload)), key).toString('base64');
  receipt.signature_algorithm = 'Ed25519';
  writeJson(receiptFile, receipt);
  const entry = readJson(queuePath(runId)); entry.state = 'PROVEN'; entry.proven_at = new Date().toISOString(); writeJson(queuePath(runId), entry);
}

function cmdVerify(runId) {
  const ids = runId ? [safeRunId(runId)] : fs.existsSync(CONFIG.queueDir) ? fs.readdirSync(CONFIG.queueDir).filter(x => x.endsWith('.json')).map(x => x.slice(0, -5)) : [];
  let failures = 0;
  for (const id of ids) {
    try {
      const entry = readJson(queuePath(id));
      if (entry.state === 'QUEUED' && Date.parse(entry.ready_at) > Date.now()) continue;
      if (entry.state === 'APPROVED' || entry.state === 'COMPILED' || entry.state === 'PROVEN') revalidateQueue(entry);
      if (entry.state === 'COMPILED' || entry.state === 'PROVEN') {
        const receipt = readJson(receiptPath(id, 'compile'));
        const actual = artifactTree(CONFIG.compilerOutDir);
        if (receipt.artifact_tree_sha256 !== treeDigest(actual)) throw new Error(`compiled artifact tree changed for ${id}`);
      }
      if (entry.state === 'PROVEN') {
        const receipt = readJson(receiptPath(id, 'compile'));
        if (!receipt.signature) throw new Error(`missing compile signature for ${id}`);
      }
    } catch (e) { console.error(`${id}: ${e.message}`); failures++; }
  }
  if (failures) process.exit(1);
  console.log(`promotion verification passed for ${ids.length} queue entr${ids.length === 1 ? 'y' : 'ies'}`);
}

function cmdList() {
  fs.mkdirSync(CONFIG.queueDir, { recursive: true });
  for (const file of fs.readdirSync(CONFIG.queueDir).filter(x => x.endsWith('.json')).sort()) {
    const q = readJson(path.join(CONFIG.queueDir, file));
    console.log(`${q.run_id}\t${q.silo}\t${q.state}\t${q.ready_at}`);
  }
}

function main() {
  const [command, runId, flag, keyPath] = process.argv.slice(2);
  try {
    if (command === 'queue') return cmdQueue(runId);
    if (command === 'approve') return cmdApprove(runId, flag === '--key' ? keyPath : null);
    if (command === 'compile') return cmdCompile(runId);
    if (command === 'sign') return cmdSign(runId, flag === '--key' ? keyPath : null);
    if (command === 'verify') return cmdVerify(runId);
    if (command === 'list') return cmdList();
    throw new Error('usage: list | queue <RUN-id> | approve <RUN-id> --key <path> | compile <RUN-id> | sign <RUN-id> --key <path> | verify [RUN-id]');
  } catch (e) { console.error(e.stack || e.message); process.exit(1); }
}
if (require.main === module) main();
module.exports = { CONFIG, canonical, sha256, artifactTree, readRunResult, cmdQueue };
