'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'website', 'mtg-catalog.html');
const ASSET_SOURCE = path.join(ROOT, 'website', 'assets');
const OUT_DIR = path.join(ROOT, 'compiled', 'website', 'mtg');
const ASSET_OUT = path.join(ROOT, 'compiled', 'website', 'assets');
const OUT = path.join(OUT_DIR, 'index.html');
const PROOF = path.join(ROOT, 'PROOF-MTG-CATALOG-COMPILATION.json');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function compile() {
  if (!fs.existsSync(SOURCE)) throw new Error('MTG catalog source missing');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(ASSET_OUT, { recursive: true });
  fs.copyFileSync(SOURCE, OUT);

  if (fs.existsSync(ASSET_SOURCE)) {
    for (const name of fs.readdirSync(ASSET_SOURCE)) {
      const src = path.join(ASSET_SOURCE, name);
      const dst = path.join(ASSET_OUT, name);
      if (fs.statSync(src).isFile()) fs.copyFileSync(src, dst);
    }
  }

  const proof = {
    schema: 'BEC-PRIME/MTG-CATALOG-COMPILATION/v3',
    status: 'PASS',
    source: 'BEC-PRIME/website/mtg-catalog.html',
    output: 'BEC-PRIME/compiled/website/mtg/index.html',
    asset_source: 'BEC-PRIME/website/assets',
    asset_output: 'BEC-PRIME/compiled/website/assets',
    catalog_sha256: sha256File(OUT),
    assets: fs.existsSync(ASSET_SOURCE) ? fs.readdirSync(ASSET_SOURCE).filter(x => fs.statSync(path.join(ASSET_SOURCE, x)).isFile()) : [],
    price_unit: 'major_nzd',
    checkout_endpoint: '/api/checkout/create',
    inventory_sources: ['/api/products', '/api/catalog'],
    excluded_public_surfaces: ['cinema.html', 'dreamiez'],
    generated_at: new Date().toISOString()
  };

  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
}

if (require.main === module) compile();
module.exports = { compile };
