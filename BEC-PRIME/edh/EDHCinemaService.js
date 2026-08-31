'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const JOB_ROOT = path.join(ROOT, 'data', 'mtg', 'edh-jobs');
const PRODUCT_ROOT = path.join(ROOT, 'catalog', 'products');
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function write(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value, 'utf8'); }
function attachCinema(proof) {
  const jobDir = path.join(JOB_ROOT, proof.job_id);
  const benchmark = read(path.join(jobDir, 'benchmark.json'));
  if (!Array.isArray(benchmark.comparisons) || benchmark.comparisons.length === 0) return proof;
  const deck = read(path.join(jobDir, 'deck.json'));
  const parentFile = path.join(PRODUCT_ROOT, proof.product_id + '.json');
  const parent = read(parentFile);
  const cinemaId = 'CINEMA_' + proof.product_id;
  const cinema = {
    id: cinemaId,
    silo: 'mtg',
    name: deck.name + ' - Cinema Benchmark',
    description: 'Comparative EDH benchmark report and hero-media package. Fixture benchmark only; not rules-accurate gameplay evidence.',
    price: 2900,
    price_unit: 'minor',
    currency: 'nzd',
    inventory: 9999,
    inventory_type: 'digital',
    status: 'draft',
    commercial_truth: { approval_required: true, sellable: false, activation_gate: 'EXPLICIT_OPERATOR_APPROVAL' },
    edh_pipeline: {
      parent_product_id: proof.product_id,
      benchmark_file: path.relative(ROOT, path.join(jobDir, 'benchmark.json')).replace(/\\/g, '/'),
      hero_asset_file: parent.edh_pipeline?.hero_asset_file || null,
      benchmark_type: 'FIXTURE_BENCHMARK'
    },
    created_at: new Date().toISOString()
  };
  write(path.join(PRODUCT_ROOT, cinemaId + '.json'), JSON.stringify(cinema, null, 2) + '\n');
  parent.edh_pipeline = parent.edh_pipeline || {};
  parent.edh_pipeline.cinema_sku = cinemaId;
  write(parentFile, JSON.stringify(parent, null, 2) + '\n');
  const proofFile = path.join(jobDir, 'PROOF.json');
  const updated = read(proofFile);
  updated.cinema_sku_id = cinemaId;
  updated.updated_at = new Date().toISOString();
  write(proofFile, JSON.stringify(updated, null, 2) + '\n');
  return updated;
}
module.exports = { attachCinema };
