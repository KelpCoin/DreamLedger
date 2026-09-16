'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { CONFIG, readRunResult, cmdQueue } = require('./BEC-PRIME/production/ProductionPromotionGate');

const ROOT = process.cwd();
const PROMOTION_DIR = path.join(ROOT, '.promotion');
const QUEUE_DIR = path.join(PROMOTION_DIR, 'queue');
const PUBLIC_KEY_PATH = path.join(PROMOTION_DIR, 'promote.pub');

function safeRunId(runId) {
  if (!runId || !/^RUN-[A-Za-z0-9._-]+$/.test(runId)) throw new Error(`invalid run id: ${runId}`);
  return runId;
}

function queuePath(runId) {
  return path.join(QUEUE_DIR, `${safeRunId(runId)}.json`);
}

function readQueue(runId) {
  const id = safeRunId(runId);
  const file = queuePath(id);
  if (!fs.existsSync(file)) throw new Error(`promotion queue entry not found: ${file}`);
  return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, file);
}

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function signJson(payload, privateKey) {
  const canonical = canonicalize(payload);
  const signature = crypto.sign(null, Buffer.from(canonical, 'utf8'), privateKey).toString('base64');
  return {
    algorithm: 'Ed25519',
    payload_sha256: sha256Bytes(Buffer.from(canonical, 'utf8')),
    signature_base64: signature
  };
}

function stripSignature(receipt) {
  const payload = { ...receipt };
  delete payload.algorithm;
  delete payload.payload_sha256;
  delete payload.signature_base64;
  return payload;
}

function verifyJson(payload, receipt, publicKey) {
  if (!receipt || receipt.algorithm !== 'Ed25519' || !receipt.signature_base64 || !receipt.payload_sha256) return false;
  const canonical = canonicalize(payload);
  const canonicalBytes = Buffer.from(canonical, 'utf8');
  if (sha256Bytes(canonicalBytes) !== receipt.payload_sha256) return false;
  return crypto.verify(null, canonicalBytes, publicKey, Buffer.from(receipt.signature_base64, 'base64'));
}

function privateKeyFromArgs(args) {
  const index = args.indexOf('--key');
  const keyPath = index >= 0 ? args[index + 1] : null;
  if (!keyPath) throw new Error('--key <path> is required');
  return crypto.createPrivateKey(fs.readFileSync(keyPath, 'utf8'));
}

function readCandidateForQueue(queue) {
  const candidateFile = path.resolve(ROOT, queue.candidate_path);
  if (!candidateFile.startsWith(ROOT + path.sep) || !fs.existsSync(candidateFile)) {
    throw new Error(`queue candidate path is invalid or missing: ${queue.candidate_path}`);
  }
  const actual = sha256File(candidateFile);
  if (actual !== queue.candidate_sha256) throw new Error('candidate changed after queueing');
  return { file: candidateFile, data: JSON.parse(fs.readFileSync(candidateFile, 'utf8')) };
}

function approve(runId, args) {
  const { data: queue } = readQueue(runId);
  if (queue.state !== 'READY_FOR_APPROVAL') throw new Error(`queue state is ${queue.state}, expected READY_FOR_APPROVAL`);
  const readyAt = Date.parse(queue.ready_at);
  if (!Number.isFinite(readyAt)) throw new Error('queue ready_at is not a valid ISO timestamp');
  if (Date.now() < readyAt) throw new Error(`24-hour cool-off has not elapsed; ${Math.ceil((readyAt - Date.now()) / 60000)} minutes remain`);

  const candidate = readCandidateForQueue(queue);
  const privateKey = privateKeyFromArgs(args);
  const approval = {
    schema: 'dreamledger-promotion-approval/v2',
    run_id: queue.run_id,
    silo: queue.silo,
    candidate_path: queue.candidate_path,
    candidate_sha256: queue.candidate_sha256,
    result_sha256: queue.result_sha256,
    gauntlet_sha256: queue.gauntlet_sha256,
    approved_by: process.env.GITHUB_ACTOR || 'manual-approval',
    workflow_run_id: process.env.GITHUB_RUN_ID || null,
    approved_at: new Date().toISOString(),
    action: 'APPROVE'
  };
  const receipt = { ...approval, ...signJson(approval, privateKey) };
  writeJson(path.join(PROMOTION_DIR, `${queue.run_id}.approval.json`), receipt);
  queue.state = 'APPROVED';
  queue.approval_path = `.promotion/${queue.run_id}.approval.json`;
  queue.approved_at = approval.approved_at;
  queue.approved_by = approval.approved_by;
  writeJson(queuePath(queue.run_id), queue);
  console.log(JSON.stringify({ receipt, candidate_sha256: sha256File(candidate.file) }, null, 2));
}

function verifyApproval(queue) {
  const approvalFile = path.join(ROOT, queue.approval_path || `.promotion/${queue.run_id}.approval.json`);
  if (!fs.existsSync(approvalFile)) throw new Error(`approval receipt not found: ${approvalFile}`);
  const receipt = JSON.parse(fs.readFileSync(approvalFile, 'utf8'));
  const publicKey = crypto.createPublicKey(fs.readFileSync(PUBLIC_KEY_PATH, 'utf8'));
  if (!verifyJson(stripSignature(receipt), receipt, publicKey)) throw new Error('invalid Ed25519 approval signature');
  if (receipt.run_id !== queue.run_id) throw new Error('approval run_id mismatch');
  if (receipt.candidate_sha256 !== queue.candidate_sha256) throw new Error('approval candidate hash mismatch');
  return receipt;
}

function compile(runId) {
  const { file, data: queue } = readQueue(runId);
  if (queue.state !== 'APPROVED') throw new Error(`queue state is ${queue.state}, expected APPROVED`);
  const candidate = readCandidateForQueue(queue);
  if (!fs.existsSync(PUBLIC_KEY_PATH)) throw new Error(`missing ${PUBLIC_KEY_PATH}`);
  verifyApproval(queue);

  const result = spawnSync('npm', ['run', 'compile'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, PROMOTION_RUN_ID: queue.run_id }
  });
  if (result.status !== 0) process.exit(result.status || 1);

  if (!fs.existsSync(CONFIG.compilerOutDir)) throw new Error(`canonical compiler output missing: ${CONFIG.compilerOutDir}`);
  queue.state = 'COMPILED';
  queue.compiled_at = new Date().toISOString();
  queue.compiler_out_dir = path.relative(ROOT, CONFIG.compilerOutDir).replace(/\\/g, '/');
  queue.candidate_sha256 = sha256File(candidate.file);
  writeJson(file, queue);
  console.log(`CANONICAL_COMPILE=PASS output=${CONFIG.compilerOutDir}`);
}

function walkFiles(dir, prefix = '') {
  if (!fs.existsSync(dir)) throw new Error(`compiler output directory not found: ${dir}`);
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    const relative = prefix ? path.join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...walkFiles(absolute, relative));
    else if (entry.isFile()) files.push({ absolute, relative: relative.replace(/\\/g, '/') });
  }
  return files;
}

function manifest() {
  const files = walkFiles(CONFIG.compilerOutDir).map(file => ({
    path: file.relative,
    bytes: fs.statSync(file.absolute).size,
    sha256: sha256File(file.absolute)
  }));
  if (files.length === 0) throw new Error('canonical compiler output directory is empty');
  return {
    schema: 'dreamledger-promotion-manifest/v2',
    root: path.relative(ROOT, CONFIG.compilerOutDir).replace(/\\/g, '/'),
    generated_at: new Date().toISOString(),
    files
  };
}

function sign(runId, args) {
  const { file, data: queue } = readQueue(runId);
  if (queue.state !== 'COMPILED') throw new Error(`queue state is ${queue.state}, expected COMPILED`);
  const privateKey = privateKeyFromArgs(args);
  const approval = verifyApproval(queue);
  const m = manifest();
  const receipt = {
    ...m,
    run_id: queue.run_id,
    silo: queue.silo,
    candidate_sha256: queue.candidate_sha256,
    approval_receipt_sha256: sha256File(path.join(ROOT, queue.approval_path))
  };
  const signed = { ...receipt, ...signJson(receipt, privateKey) };
  writeJson(path.join(PROMOTION_DIR, `${queue.run_id}.manifest.json`), signed);
  queue.state = 'SIGNED';
  queue.manifest_path = `.promotion/${queue.run_id}.manifest.json`;
  queue.signed_at = new Date().toISOString();
  queue.manifest_sha256 = sha256File(path.join(PROMOTION_DIR, `${queue.run_id}.manifest.json`));
  queue.approval_receipt_sha256 = sha256File(path.join(ROOT, queue.approval_path));
  queue.approval_verified = Boolean(approval);
  writeJson(file, queue);
  console.log(JSON.stringify(signed, null, 2));
}

function verifyReceipt(name, publicKey) {
  const file = path.join(PROMOTION_DIR, name);
  const receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!verifyJson(stripSignature(receipt), receipt, publicKey)) throw new Error(`invalid Ed25519 signature: ${name}`);
}

function verify(runId) {
  if (!fs.existsSync(PUBLIC_KEY_PATH)) throw new Error(`missing ${PUBLIC_KEY_PATH}; publish the Ed25519 public key before enabling promotion`);
  const publicKey = crypto.createPublicKey(fs.readFileSync(PUBLIC_KEY_PATH, 'utf8'));
  const id = runId ? safeRunId(runId) : null;
  const names = fs.existsSync(PROMOTION_DIR)
    ? fs.readdirSync(PROMOTION_DIR).filter(name => name.endsWith('.approval.json') || name.endsWith('.manifest.json'))
    : [];
  const selected = id ? names.filter(name => name.startsWith(`${id}.`)) : names;
  if (selected.length === 0) throw new Error(`no signed promotion receipts found${id ? ` for ${id}` : ''}`);
  for (const name of selected) verifyReceipt(name, publicKey);
  console.log(`PROMOTION_SIGNATURES=PASS (${selected.length})`);
}

const [command, id, ...args] = process.argv.slice(2);
try {
  if (command === 'queue') cmdQueue(id);
  else if (command === 'approve') approve(id, args);
  else if (command === 'compile') compile(id);
  else if (command === 'sign') sign(id, args);
  else if (command === 'verify') verify(id);
  else throw new Error('Usage: node promote.js <queue|approve|compile|sign|verify> <run_id> [--key path]');
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
