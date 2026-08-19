'use strict';

const fs = require('fs');
const path = require('path');
const { compile } = require('../compiler/UniversalCompiler');

const ROOT = path.join(__dirname, '..');
const result = compile();
if (result.status !== 'PASS') throw new Error('Universal compiler did not PASS');

const smokeIds = ['smoke-website', 'smoke-game', 'smoke-app'];
const productionIds = ['dreamledger-production', 'amplissa-public', 'kelplantis-mvp'];
const expectedIds = [...smokeIds, ...productionIds];

if (result.specs_compiled !== expectedIds.length) {
  throw new Error(`Expected ${expectedIds.length} universal specs, got ${result.specs_compiled}`);
}

for (const id of expectedIds) {
  const row = result.outputs.find(x => x.id === id);
  if (!row) throw new Error(`Missing universal target output: ${id}`);
  if (!row.files.some(x => x.path.endsWith('/index.html'))) {
    throw new Error(`Missing HTML output for: ${id}`);
  }
}

for (const target of ['website', 'game', 'app']) {
  const rows = result.outputs.filter(x => x.target === target);
  if (rows.length === 0) throw new Error(`Missing target output: ${target}`);
}

const proof = path.join(ROOT, 'RUN-PROOFS', 'UNIVERSAL-COMPILER-PROOF.json');
if (!fs.existsSync(proof)) throw new Error('Universal compiler proof missing');

console.log(JSON.stringify({
  status: 'PASS',
  compiler: result.compiler,
  targets: result.targets_supported,
  smoke_specs: smokeIds,
  production_specs: productionIds,
  specs_compiled: result.specs_compiled,
  proof: 'RUN-PROOFS/UNIVERSAL-COMPILER-PROOF.json',
  native_mobile_binary: result.native_mobile_binary
}, null, 2));
