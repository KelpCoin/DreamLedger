'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const CANDIDATE_DIR = path.join(ROOT, 'candidates');
const PROMOTION_DIR = path.join(ROOT, '.promotion');
const PUBLIC_KEY_PATH = path.join(PROMOTION_DIR, 'promote.pub');

function candidatePath(id) {
  if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new Error('invalid candidate id');
  return path.join(CANDIDATE_DIR, `${id}.json`);
}

function readCandidate(id) {
  const file = candidatePath(id);
  if (!fs.existsSync(file)) throw new Error(`candidate not found: ${file}`);
  return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function privateKeyFromArgs(args) {
  const index = args.indexOf('--key');
  const keyPath = index >= 0 ? args[index + 1] : null;
  if (!keyPath) throw new Error('--key <path> is required');
  return crypto.createPrivateKey(fs.readFileSync(keyPath, 'utf8'));
}

function signJson(payload, privateKey) {
  const canonical = JSON.stringify(payload);
  const signature = crypto.sign(null, Buffer.from(canonical, 'utf8'), privateKey).toString('base64');
  return { algorithm: 'Ed25519', payload_sha256: crypto.createHash('sha256').update(canonical).digest('hex'), signature_base64: signature };
}

function verifyJson(payload, receipt, publicKey) {
  const canonical = JSON.stringify(payload);
  return crypto.verify(null, Buffer.from(canonical, 'utf8'), publicKey, Buffer.from(receipt.signature_base64, 'base64'));
}

function approve(id, args) {
  const { file, data } = readCandidate(id);
  if (data.state !== 'READY_FOR_APPROVAL') throw new Error(`candidate state is ${data.state}, expected READY_FOR_APPROVAL`);
  const privateKey = privateKeyFromArgs(args);
  const approval = {
    schema: 'dreamledger-promotion-approval/v1',
    candidate_id: id,
    candidate_hash: crypto.createHash('sha256').update(JSON.stringify(data), 'utf8').digest('hex'),
    approved_by: process.env.GITHUB_ACTOR || 'manual-approval',
    workflow_run_id: process.env.GITHUB_RUN_ID || null,
    approved_at: new Date().toISOString(),
    action: 'APPROVE'
  };
  const receipt = { ...approval, ...signJson(approval, privateKey) };
  writeJson(path.join(PROMOTION_DIR, `${id}.approval.json`), receipt);
  data.state = 'APPROVED';
  data.approval = { receipt: `.promotion/${id}.approval.json`, approved_by: approval.approved_by, approved_at: approval.approved_at };
  writeJson(file, data);
  console.log(JSON.stringify(receipt, null, 2));
}

function compile(id) {
  const { data } = readCandidate(id);
  if (data.state !== 'APPROVED') throw new Error(`candidate state is ${data.state}, expected APPROVED`);
  const result = spawnSync('npm', ['run', 'compile'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status || 1);
  data.state = 'COMPILED';
  data.compiled_at = new Date().toISOString();
  writeJson(candidatePath(id), data);
}

function trackedFiles() {
  const result = spawnSync('git', ['ls-files', 'public', 'BEC-PRIME/compiled'], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('git ls-files failed');
  return result.stdout.split(/\r?\n/).filter(Boolean).sort();
}

function manifest() {
  const files = trackedFiles().map(file => {
    const bytes = fs.readFileSync(path.join(ROOT, file));
    return { path: file, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  });
  return { schema: 'dreamledger-promotion-manifest/v1', generated_at: new Date().toISOString(), files };
}

function sign(id, args) {
  const { data } = readCandidate(id);
  if (data.state !== 'COMPILED') throw new Error(`candidate state is ${data.state}, expected COMPILED`);
  const privateKey = privateKeyFromArgs(args);
  const m = manifest();
  const receipt = { ...m, candidate_id: id, candidate_hash: crypto.createHash('sha256').update(JSON.stringify(data), 'utf8').digest('hex') };
  const signed = { ...receipt, ...signJson(receipt, privateKey) };
  writeJson(path.join(PROMOTION_DIR, `${id}.manifest.json`), signed);
  data.state = 'SIGNED';
  data.manifest = `.promotion/${id}.manifest.json`;
  data.signed_at = new Date().toISOString();
  writeJson(candidatePath(id), data);
  console.log(JSON.stringify(signed, null, 2));
}

function verify() {
  if (!fs.existsSync(PUBLIC_KEY_PATH)) throw new Error(`missing ${PUBLIC_KEY_PATH}; publish the Ed25519 public key before enabling promotion`);
  const publicKey = crypto.createPublicKey(fs.readFileSync(PUBLIC_KEY_PATH, 'utf8'));
  const files = fs.readdirSync(PROMOTION_DIR).filter(x => x.endsWith('.approval.json') || x.endsWith('.manifest.json'));
  for (const name of files) {
    const receipt = JSON.parse(fs.readFileSync(path.join(PROMOTION_DIR, name), 'utf8'));
    const payload = { ...receipt };
    delete payload.algorithm;
    delete payload.payload_sha256;
    delete payload.signature_base64;
    if (!verifyJson(payload, receipt, publicKey)) throw new Error(`invalid Ed25519 signature: ${name}`);
  }
  console.log(`PROMOTION_SIGNATURES=PASS (${files.length})`);
}

const [command, id, ...args] = process.argv.slice(2);
try {
  if (command === 'approve') approve(id, args);
  else if (command === 'compile') compile(id);
  else if (command === 'sign') sign(id, args);
  else if (command === 'verify') verify();
  else throw new Error('Usage: node promote.js <approve|compile|sign|verify> <candidate_id> [--key path]');
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
