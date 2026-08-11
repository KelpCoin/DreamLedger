'use strict';

const fs = require('fs');
const path = require('path');
const child = require('child_process');

const ROOT = path.join(__dirname, '..');
const catalog = path.join(ROOT, 'catalog', 'evergreen-products.json');
const generator = path.join(ROOT, 'catalog', 'generate-evergreen-products.js');
const feedBuilder = path.join(ROOT, 'catalog', 'build-agentic-feed.js');
const feed = path.join(ROOT, 'compiled', 'website', 'agentic', 'catalog.json');
const shop = path.join(ROOT, 'compiled', 'website', 'shop', 'index.html');
const mtg = path.join(ROOT, 'compiled', 'website', 'mtg', 'index.html');
const wall = path.join(ROOT, 'runtime', 'EntitlementWall.js');
const start = path.join(ROOT, 'start.js');
const auctions = path.join(ROOT, 'data', 'auctions.json');

const tests = [];
function test(name, fn) { try { fn(); tests.push({ name, status: 'PASS' }); } catch (err) { tests.push({ name, status: 'FAIL', error: err.message }); } }

test('generator exists', () => { if (!fs.existsSync(generator)) throw Error('generator missing'); });
test('agentic feed builder exists', () => { if (!fs.existsSync(feedBuilder)) throw Error('agentic feed builder missing'); });
test('shop surface exists', () => { if (!fs.existsSync(shop)) throw Error('shop surface missing'); });
test('MTG silo surface exists', () => { if (!fs.existsSync(mtg)) throw Error('MTG silo surface missing'); });
test('entitlement wall exists', () => { if (!fs.existsSync(wall)) throw Error('entitlement wall missing'); });
test('runtime exposes entitlement API', () => { const x=fs.readFileSync(start,'utf8'); if (!x.includes('/api/entitlements/check')) throw Error('entitlement route missing'); });
test('runtime exposes protected goods API', () => { const x=fs.readFileSync(start,'utf8'); if (!x.includes('/api/goods/')) throw Error('protected goods route missing'); });
test('candidate catalog compiles to 100 products', () => {
  child.execFileSync(process.execPath, [generator], { cwd: ROOT, stdio: 'pipe' });
  const data = JSON.parse(fs.readFileSync(catalog, 'utf8'));
  if (data.count !== 100 || data.products.length !== 100) throw Error(`expected 100 products, got ${data.products?.length}`);
  const ids = new Set(data.products.map(x => x.product_id));
  if (ids.size !== 100) throw Error('duplicate product IDs');
  if (data.products.some(x => x.status !== 'candidate')) throw Error('candidate catalog contains activated product');
  if (data.products.filter(x => x.channel === 'human-first').length !== 50) throw Error('human-first count is not 50');
  if (data.products.filter(x => x.channel === 'agent-ready').length !== 50) throw Error('agent-ready count is not 50');
  if (data.products.some(x => !x.gauntlet || !x.elohim_role || !x.asymmetric_leverage)) throw Error('leverage/governance metadata missing');
});
test('agentic feed compiles to 100 products', () => {
  child.execFileSync(process.execPath, [feedBuilder], { cwd: ROOT, stdio: 'pipe' });
  const data = JSON.parse(fs.readFileSync(feed, 'utf8'));
  if (data.products.length !== 100) throw Error(`expected 100 agentic feed products, got ${data.products.length}`);
  if (data.payment.cryptocurrency !== false) throw Error('crypto policy mismatch');
});
test('three MTG auction windows exist and are approval gated', () => {
  const data = JSON.parse(fs.readFileSync(auctions, 'utf8'));
  const mtg = data.auctions.filter(x => x.silo === 'SILO_MTG').sort((a,b) => a.ends_at-b.ends_at);
  if (mtg.length < 3) throw Error(`expected at least 3 MTG auctions, got ${mtg.length}`);
  if (new Set(mtg.slice(0,3).map(x => x.ends_at)).size !== 3) throw Error('auction endings are not distinct');
  if (mtg.slice(0,3).some(x => x.approval_required !== true || x.checkout_available !== false)) throw Error('auction approval boundary is broken');
});
test('SEO and agent surfaces exist', () => {
  for (const file of ['robots.txt','sitemap.xml','llms.txt','manifest.webmanifest','.well-known/commerce.json','calendar.ics']) {
    if (!fs.existsSync(path.join(ROOT, 'compiled', 'website', file))) throw Error(`missing ${file}`);
  }
});
test('MTG brand boundary is correct', () => {
  const text = fs.readFileSync(shop, 'utf8') + fs.readFileSync(mtg, 'utf8');
  if (!text.includes('HAPPYHOMARID MASTER SELLERS')) throw Error('HappyHomarid brand missing');
});
test('no public private-goods directory', () => {
  const publicRoot = path.join(ROOT, 'compiled', 'website');
  const privateRoot = path.join(ROOT, 'private-goods');
  if (fs.existsSync(privateRoot) && privateRoot.startsWith(publicRoot)) throw Error('private goods nested under public root');
});

const failed = tests.filter(x => x.status === 'FAIL');
const result = { status: failed.length ? 'FAIL' : 'PASS', tests, generated_count: 100, smoke_all_products: failed.length === 0 };
console.log(JSON.stringify(result, null, 2));
process.exitCode = failed.length ? 1 : 0;
