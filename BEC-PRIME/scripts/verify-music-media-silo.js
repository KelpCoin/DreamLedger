'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readJson = p => JSON.parse(read(p));
const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail });
}

const rootPage = 'music-media/index.html';
const publicPage = 'public/music-media/index.html';
const rootCatalog = 'data/music-media-catalog.json';
const publicCatalog = 'public/data/music-media-catalog.json';
const rootAlias = 'music-media.html';
const publicAlias = 'public/music-media.html';

for (const p of [rootPage, publicPage, rootCatalog, publicCatalog, rootAlias, publicAlias,
  'docs/BECK-EMPIRE-SILO-REGISTRY.json', 'docs/BECK-SILO-FEE-POLICY.json']) {
  check('required file exists: ' + p, fs.existsSync(path.join(ROOT, p)));
}
check('storefront copies match', read(rootPage) === read(publicPage));
check('catalogue copies match', read(rootCatalog) === read(publicCatalog));
check('legacy aliases match', read(rootAlias) === read(publicAlias));

const catalogue = readJson(rootCatalog);
const registry = readJson('docs/BECK-EMPIRE-SILO-REGISTRY.json');
const fees = readJson('docs/BECK-SILO-FEE-POLICY.json');
const silo = registry.silos && registry.silos.MUSIC_MEDIA;
const fee = fees.rules && fees.rules['dreamledger-music-media'];

check('catalogue schema is correct', catalogue.schema === 'dreamledger/music-media-catalogue/v1');
check('catalogue is isolated to music-media', catalogue.silo === 'music-media');
check('catalogue products is an array', Array.isArray(catalogue.products));
check('registry declares canonical route', Boolean(silo && silo.id === 'dreamledger-music-media' && (silo.public_prefixes || []).includes('/music-media')));
check('non-MTG platform fee is 500 bps', Boolean(silo && silo.platform_fee_bps === 500 && fee && fee.platform_fee_bps === 500));
check('page reads the silo-specific catalogue', read(rootPage).includes("fetch('/data/music-media-catalog.json'"));

const products = Array.isArray(catalogue.products) ? catalogue.products : [];
for (const p of products) {
  check('listing is explicitly assigned to this silo: ' + (p.id || p.title || 'unknown'), p.silo === 'music-media');
  if (p.checkout_available === true) {
    check('checkout URL is a Stripe Payment Link: ' + (p.id || p.title || 'unknown'),
      typeof p.checkout_url === 'string' && /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/.test(p.checkout_url));
    check('checkout has verified rights and delivery: ' + (p.id || p.title || 'unknown'),
      p.rights_status === 'verified' && p.delivery_status === 'verified');
  }
}

const failures = checks.filter(c => !c.ok);
console.log(JSON.stringify({
  schema: 'DREAMLEDGER/MUSIC-MEDIA-VERIFICATION/v1',
  status: failures.length ? 'FAIL' : 'PASS',
  checks,
  failed_checks: failures.length
}, null, 2));
if (failures.length) process.exit(1);
