'use strict';

const fs = require('fs');
const path = require('path');
const { compile } = require('../compiler/UniversalCompiler');

const ROOT = path.join(__dirname, '..');
const result = compile();
if (result.status !== 'PASS') throw new Error('Universal compiler did not PASS');
if (result.specs_compiled !== 3) throw new Error(`Expected 3 smoke specs, got ${result.specs_compiled}`);
for (const target of ['website', 'game', 'app']) {
  const row = result.outputs.find(x => x.target === target);
  if (!row) throw new Error(`Missing target output: ${target}`);
  if (!row.files.some(x => x.path.endsWith('/index.html'))) throw new Error(`Missing HTML output for ${target}`);
}
const proof = path.join(ROOT, 'RUN-PROOFS', 'UNIVERSAL-COMPILER-PROOF.json');
if (!fs.existsSync(proof)) throw new Error('Universal compiler proof missing');
console.log(JSON.stringify({
  status: 'PASS',
  compiler: result.compiler,
  targets: result.targets_supported,
  specs_compiled: result.specs_compiled,
  proof: 'RUN-PROOFS/UNIVERSAL-COMPILER-PROOF.json',
  native_mobile_binary: result.native_mobile_binary
}, null, 2));
