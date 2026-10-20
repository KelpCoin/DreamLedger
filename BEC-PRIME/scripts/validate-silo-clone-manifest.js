'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { validateCloneManifest, createSignedVerdict, stableStringify } = require('../lib/siloCloneContract');

function parseArgs(args) {
  const positional = [];
  const flags = new Set();
  for (const arg of args) {
    if (arg.startsWith('--')) flags.add(arg);
    else positional.push(arg);
  }
  const modeArg = [...flags].find(x => x.startsWith('--mode='));
  const mode = modeArg ? modeArg.slice('--mode='.length) : 'advisory';
  if (!['advisory', 'enforce'].includes(mode)) throw new Error('mode must be advisory or enforce');
  return { manifestPath: positional[0], mode, requireSignature: flags.has('--require-signature') };
}

function addError(verdict, code, message) {
  verdict.errors.push({ code, message });
  verdict.error_count = verdict.errors.length;
  verdict.status = 'BLOCK';
  verdict.publish_allowed = false;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.manifestPath) throw new Error('Usage: node validate-silo-clone-manifest.js <manifest.json> [--mode=advisory|enforce] [--require-signature]');
  const absolutePath = path.resolve(process.cwd(), args.manifestPath);
  const bytes = fs.readFileSync(absolutePath);
  const manifest = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  const verdict = validateCloneManifest(manifest);
  const privateKeyPem = process.env.DREAMLEDGER_CLONE_VERDICT_PRIVATE_KEY || '';
  if (args.requireSignature && !privateKeyPem.trim()) {
    addError(verdict, 'VERDICT_SIGNATURE_KEY_REQUIRED', 'Enforced clone publication requires DREAMLEDGER_CLONE_VERDICT_PRIVATE_KEY containing a private Ed25519 key; do not publish an unsigned verdict.');
  }

  const payload = {
    schema: 'DREAMLEDGER/SILO-CLONE-VERDICT/v1',
    mode: args.mode.toUpperCase(),
    manifest_path: path.relative(process.cwd(), absolutePath).replace(/\\/g, '/') || path.basename(absolutePath),
    manifest_sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    generated_at: new Date().toISOString(),
    verdict
  };
  const signing = createSignedVerdict(payload, privateKeyPem.trim() ? privateKeyPem : null);
  const envelope = { ...payload, signing };
  process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');

  if (args.mode === 'enforce' && verdict.status !== 'PASS') process.exitCode = 2;
  if (args.requireSignature && signing.status !== 'SIGNED') process.exitCode = 2;
}

try {
  main();
} catch (error) {
  process.stderr.write('CLONE_CONTRACT_VALIDATOR_ERROR: ' + (error && error.message ? error.message : String(error)) + '\n');
  process.exitCode = 2;
}
