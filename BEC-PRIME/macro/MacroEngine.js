'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const sniper = require('../brain/SniperLoop');
const builder = require('../factory/BuilderBoss');
const gauntlet = require('../gauntlet/GauntletV6');

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
  const top = opportunities.find(x => x.status === 'CANDIDATE') || null;
  const pack = top ? builder.write(top) : null;
  const gauntletResult = gauntlet.run();
  const compile = spawnSync(process.execPath, [path.join(ROOT, 'compiler', 'ProductCompiler.js')], { cwd: ROOT, encoding: 'utf8' });
  const result = {
    schema_version: 'BEC-MACRO-ENGINE-1.0',
    status: gauntletResult.status === 'PASS' && compile.status === 0 ? 'PASS' : 'FAIL',
    selected_opportunity: top,
    action_pack: pack,
    gauntlet: gauntletResult.status,
    product_compile: compile.status === 0 ? 'PASS' : 'FAIL',
    public_actions_executed: false,
    approval_boundary: 'REQUIRED',
    next_atom: pack ? pack.atoms[0] : null,
    generated_at_utc: new Date().toISOString()
  };
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(PROOF, JSON.stringify(result, null, 2) + '\n');
  log('macro.cycle', { status: result.status, selected: top?.source || null, pack: pack?.action_pack_id || null });
  return result;
}

if (require.main === module) { const result = run(); console.log(JSON.stringify(result, null, 2)); process.exit(result.status === 'PASS' ? 0 : 1); }
module.exports = { run };
