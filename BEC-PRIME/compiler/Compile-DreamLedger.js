'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { compile } = require('./UniversalCompiler');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, '..', 'index.html');
const OUT = path.join(ROOT, 'compiled', 'universal', 'website', 'dreamledger', 'index.html');
const PROOF = path.join(ROOT, 'RUN-PROOFS', 'DREAMLEDGER-WEBSITE-COMPILER-PROOF.json');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, 'utf8');
}

if (!fs.existsSync(SOURCE)) throw new Error(`DreamLedger source missing: ${SOURCE}`);

const universal = compile();
if (universal.status !== 'PASS') throw new Error('Universal compiler smoke did not PASS');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.copyFileSync(SOURCE, OUT);

const proof = {
  schema: 'BEC-PRIME/DREAMLEDGER-WEBSITE-COMPILER-PROOF/v1',
  status: 'PASS',
  compiler: 'DreamLedgerWebsiteCompiler/v1',
  source: 'index.html',
  output: 'BEC-PRIME/compiled/universal/website/dreamledger/index.html',
  production_domain: 'https://dreamledger.org',
  source_sha256: sha256File(SOURCE),
  output_sha256: sha256File(OUT),
  exact_source_copy: sha256File(SOURCE) === sha256File(OUT),
  universal_compiler_smoke: 'PASS'
};

if (!proof.exact_source_copy) throw new Error('Compiled DreamLedger output hash does not match source hash');
write(PROOF, JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof, null, 2));
