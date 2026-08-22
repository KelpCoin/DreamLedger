'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'website', 'mtg-catalog.html');
const OUT_DIR = path.join(ROOT, 'compiled', 'website', 'mtg');
const OUT = path.join(OUT_DIR, 'index.html');
const CINEMA_SOURCE = path.join(ROOT, '..', 'cinema.html');
const CINEMA_OUT = path.join(ROOT, 'compiled', 'website', 'cinema.html');
const PROOF = path.join(ROOT, 'PROOF-MTG-CATALOG-COMPILATION.json');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function compile() {
  if (!fs.existsSync(SOURCE)) throw new Error('MTG catalog source missing');
  if (!fs.existsSync(CINEMA_SOURCE)) throw new Error('Cinema source missing');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.copyFileSync(SOURCE, OUT);
  fs.copyFileSync(CINEMA_SOURCE, CINEMA_OUT);
  const proof = {
    schema: 'BEC-PRIME/MTG-CATALOG-COMPILATION/v1',
    status: 'PASS',
    source: 'BEC-PRIME/website/mtg-catalog.html',
    output: 'BEC-PRIME/compiled/website/mtg/index.html',
    cinema_source: 'cinema.html',
    cinema_output: 'BEC-PRIME/compiled/website/cinema.html',
    catalog_sha256: sha256File(OUT),
    cinema_sha256: sha256File(CINEMA_OUT),
    price_unit: 'major_nzd',
    checkout_endpoint: '/api/checkout/create',
    inventory_source: '/api/products',
    generated_at: new Date().toISOString()
  };
  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
}

if (require.main === module) compile();
module.exports = { compile };
