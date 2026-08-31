'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const JOBS = path.join(ROOT, 'data', 'mtg', 'edh-jobs');

function fail(message) { throw new Error(message); }
function sha256(value) { const crypto = require('crypto'); return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function main() {
  if (!fs.existsSync(JOBS)) fail('NO_EDH_JOB_ROOT');
  const jobs = fs.readdirSync(JOBS).filter(id => fs.existsSync(path.join(JOBS, id, 'PROOF.json'))).sort();
  if (!jobs.length) fail('NO_EDH_PROOF_FOUND');
  const jobId = jobs[jobs.length - 1];
  const dir = path.join(JOBS, jobId);
  const proof = read(path.join(dir, 'PROOF.json'));
  const deck = read(path.join(dir, 'deck.json'));
  const benchmark = read(path.join(dir, 'benchmark.json'));
  const productFile = path.join(ROOT, 'catalog', 'products', proof.product_id + '.json');
  if (!fs.existsSync(productFile)) fail('MISSING_PRODUCT');
  const product = read(productFile);
  for (const file of ['deck.json', 'benchmark.json', 'primer.md', 'hero-prompt.txt', 'PROOF.json', 'STATE.json']) {
    if (!fs.existsSync(path.join(dir, file))) fail('MISSING_' + file);
  }
  if (proof.job_id !== jobId) fail('JOB_ID_MISMATCH');
  if (proof.schema_version !== 'edh-one-link-proof-v1') fail('SCHEMA_MISMATCH');
  if (proof.approval_required !== true) fail('APPROVAL_BOUNDARY_MISSING');
  if (proof.benchmark_type !== 'FIXTURE_BENCHMARK') fail('UNDECLARED_BENCHMARK_TYPE');
  if (!Array.isArray(deck.cards) || deck.total_cards < 90 || deck.total_cards > 120) fail('NORMALIZED_DECK_INVALID');
  if (benchmark.schema_version !== 'edh-benchmark-manifest-v1') fail('BENCHMARK_SCHEMA_MISMATCH');
  if (product.silo !== 'mtg' || product.status !== 'draft') fail('PRODUCT_NOT_SAFE_DRAFT');
  if (product.commercial_truth?.approval_required !== true || product.commercial_truth?.sellable !== false) fail('PRODUCT_APPROVAL_GATE_BROKEN');
  const primer = fs.readFileSync(path.join(dir, 'primer.md'), 'utf8');
  const heroPrompt = fs.readFileSync(path.join(dir, 'hero-prompt.txt'), 'utf8');
  if (sha256(primer) !== proof.primer_sha256) fail('PRIMER_HASH_MISMATCH');
  if (sha256(heroPrompt) !== proof.hero_prompt_sha256) fail('HERO_PROMPT_HASH_MISMATCH');
  console.log(JSON.stringify({ status: 'PASS', job_id: jobId, product_id: proof.product_id, state: proof.state, comparisons: proof.comparison_ids.length, benchmark_type: proof.benchmark_type, media_status: proof.media_status, approval_required: proof.approval_required }, null, 2));
}
main();
