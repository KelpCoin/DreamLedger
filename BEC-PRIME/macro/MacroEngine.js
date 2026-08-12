'use strict';

const fs = require('fs');
const path = require('path');
const sniper = require('../brain/SniperLoop');
const elohim = require('../council/Elohim');

const ROOT = path.join(__dirname, '..');
const PRODUCT_DIR = path.join(ROOT, 'catalog', 'products');
const DATA = path.join(ROOT, 'data', 'autonomy');
const LOG = path.join(DATA, 'macro.jsonl');
const PROOF = path.join(DATA, 'MACRO-LATEST.json');

function loadProducts() {
  if (!fs.existsSync(PRODUCT_DIR)) return [];
  return fs.readdirSync(PRODUCT_DIR).filter(x => x.endsWith('.json')).map(x => JSON.parse(fs.readFileSync(path.join(PRODUCT_DIR, x), 'utf8')));
}
function log(event, data) { fs.mkdirSync(DATA, { recursive: true }); fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), event, ...data }) + '\n'); }
function run() {
  const products = loadProducts();
  const opportunities = sniper.run(products);
  const selected = opportunities.find(x => x.status === 'CANDIDATE') || null;
  const council = selected ? elohim.run(products) : null;
  const result = {
    schema_version: 'BEC-MACRO-ENGINE-2.0',
    status: council?.verdict === 'SHIP_TO_BUYER_GATE' ? 'PASS' : 'WAIT',
    selected_opportunity: selected,
    council,
    public_actions_executed: false,
    approval_boundary: 'REQUIRED',
    settlement_boundary: 'BUYER_INITIATED_ONLY',
    generated_at_utc: new Date().toISOString()
  };
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(PROOF, JSON.stringify(result, null, 2) + '\n');
  log('macro.cycle', { status: result.status, selected: selected?.source || null, verdict: council?.verdict || null });
  return result;
}

if (require.main === module) { const result = run(); console.log(JSON.stringify(result, null, 2)); process.exit(result.status === 'PASS' ? 0 : 0); }
module.exports = { run };
