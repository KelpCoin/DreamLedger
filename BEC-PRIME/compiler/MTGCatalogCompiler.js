'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..');
const SOURCE = path.join(ROOT, 'website', 'mtg-catalog.html');
const ASSET_SOURCE = path.join(ROOT, 'website', 'assets');
const OUT_DIR = path.join(ROOT, 'compiled', 'website', 'mtg');
const ASSET_OUT = path.join(ROOT, 'compiled', 'website', 'assets');
const OUT = path.join(OUT_DIR, 'index.html');
const ROOT_MASTER = path.join(REPO_ROOT, 'mtg', 'index.html');
const PUBLIC_ROOT = path.join(REPO_ROOT, 'public');
const PUBLIC_MASTER = path.join(PUBLIC_ROOT, 'mtg', 'index.html');
const CATALOG_SOURCE = path.join(REPO_ROOT, 'data', 'mtg-catalog.json');
const PUBLIC_CATALOG = path.join(PUBLIC_ROOT, 'data', 'mtg-catalog.json');
const PROOF = path.join(ROOT, 'PROOF-MTG-CATALOG-COMPILATION.json');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copyEnsuringDir(source, destination) {
  if (!fs.existsSync(source)) throw new Error('Required MTG compiler input missing: ' + path.relative(REPO_ROOT, source));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function compile() {
  if (!fs.existsSync(SOURCE)) throw new Error('MTG catalog source missing');
  if (!fs.existsSync(CATALOG_SOURCE)) throw new Error('Canonical MTG catalogue data missing');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(ASSET_OUT, { recursive: true });

  copyEnsuringDir(SOURCE, OUT);
  copyEnsuringDir(SOURCE, ROOT_MASTER);
  copyEnsuringDir(SOURCE, PUBLIC_MASTER);
  copyEnsuringDir(CATALOG_SOURCE, PUBLIC_CATALOG);

  if (fs.existsSync(ASSET_SOURCE)) {
    for (const name of fs.readdirSync(ASSET_SOURCE)) {
      const src = path.join(ASSET_SOURCE, name);
      const dst = path.join(ASSET_OUT, name);
      if (fs.statSync(src).isFile()) fs.copyFileSync(src, dst);
    }
  }

  const proof = {
    schema: 'BEC-PRIME/MTG-CATALOG-COMPILATION/v4',
    status: 'PASS',
    source: 'BEC-PRIME/website/mtg-catalog.html',
    output: 'BEC-PRIME/compiled/website/mtg/index.html',
    root_master_output: 'mtg/index.html',
    public_master_output: 'public/mtg/index.html',
    canonical_catalogue_source: 'data/mtg-catalog.json',
    public_catalogue_output: 'public/data/mtg-catalog.json',
    catalog_sha256: sha256File(OUT),
    canonical_data_sha256: sha256File(CATALOG_SOURCE),
    root_master_sha256: sha256File(ROOT_MASTER),
    public_master_sha256: sha256File(PUBLIC_MASTER),
    public_catalogue_sha256: sha256File(PUBLIC_CATALOG),
    static_master_copies_identical: sha256File(ROOT_MASTER) === sha256File(PUBLIC_MASTER),
    public_catalogue_matches_canonical: sha256File(CATALOG_SOURCE) === sha256File(PUBLIC_CATALOG),
    assets: fs.existsSync(ASSET_SOURCE) ? fs.readdirSync(ASSET_SOURCE).filter(x => fs.statSync(path.join(ASSET_SOURCE, x)).isFile()) : [],
    price_unit: 'major_nzd',
    checkout_endpoint: '/api/checkout/create',
    inventory_sources: ['/api/products', '/api/catalog'],
    excluded_public_surfaces: ['cinema.html', 'dreamiez'],
    generated_at: new Date().toISOString()
  };

  if (!proof.static_master_copies_identical || !proof.public_catalogue_matches_canonical) {
    throw new Error('MTG static publication parity failed');
  }

  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
}

if (require.main === module) compile();
module.exports = { compile };
