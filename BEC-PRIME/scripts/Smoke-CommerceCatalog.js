'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const generator = path.join(ROOT, 'catalog', 'generate-evergreen-products.js');
const feedBuilder = path.join(ROOT, 'catalog', 'build-agentic-feed.js');
const catalogFile = path.join(ROOT, 'catalog', 'evergreen-products.json');
const feedFile = path.join(ROOT, 'compiled', 'website', 'agentic', 'catalog.json');
const results = [];
function check(name, fn) { try { fn(); results.push({ name, status: 'PASS' }); } catch (e) { results.push({ name, status: 'FAIL', error: e.message }); } }

check('regenerate evergreen catalog', () => execFileSync(process.execPath, [generator], { cwd: ROOT, stdio: 'pipe' }));
check('regenerate agentic feed', () => execFileSync(process.execPath, [feedBuilder], { cwd: ROOT, stdio: 'pipe' }));

let catalog;
let feed;
check('catalog has 100 products', () => {
  catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  if (catalog.count !== 100 || catalog.products.length !== 100) throw new Error(`expected 100, got ${catalog.products.length}`);
});
check('channel split is 50/50', () => {
  const counts = catalog.products.reduce((a, p) => { a[p.channel] = (a[p.channel] || 0) + 1; return a; }, {});
  if (counts['human-first'] !== 50 || counts['agent-ready'] !== 50) throw new Error(JSON.stringify(counts));
});
check('all product records pass smoke rules', () => {
  const ids = new Set();
  for (const p of catalog.products) {
    if (ids.has(p.product_id)) throw new Error(`duplicate id ${p.product_id}`);
    ids.add(p.product_id);
    for (const field of ['product_id','title','category','buyer','competitor','fulfilment','silo','channel','gauntlet','elohim_role','asymmetric_leverage']) if (!p[field]) throw new Error(`${p.product_id}: missing ${field}`);
    if (!Number.isFinite(p.price_nzd) || p.price_nzd <= 0) throw new Error(`${p.product_id}: invalid price`);
    if (p.status !== 'candidate') throw new Error(`${p.product_id}: candidate catalog contains non-candidate state`);
    if (p.channel === 'agent-ready' && p.agentic_ready !== true) throw new Error(`${p.product_id}: agentic flag mismatch`);
    if (p.agentic_contract.payment_asset !== 'no cryptocurrency accepted') throw new Error(`${p.product_id}: crypto policy mismatch`);
    if (p.entitlement.mode !== 'permanent') throw new Error(`${p.product_id}: entitlement mode mismatch`);
  }
});
check('agentic feed mirrors all 100 products', () => {
  feed = JSON.parse(fs.readFileSync(feedFile, 'utf8'));
  if (!Array.isArray(feed.products) || feed.products.length !== 100) throw new Error('agentic feed count mismatch');
  const ids = new Set(feed.products.map(p => p.id));
  if (ids.size !== 100) throw new Error('agentic feed duplicate IDs');
  if (feed.payment.cryptocurrency !== false) throw new Error('agentic feed crypto policy mismatch');
});
check('protected goods are outside public website root', () => {
  const publicRoot = path.join(ROOT, 'compiled', 'website');
  const privateRoot = path.join(ROOT, 'private-goods');
  if (privateRoot.startsWith(publicRoot)) throw new Error('private goods boundary is invalid');
});
check('SEO surfaces exist', () => {
  for (const file of ['index.html','shop/index.html','mtg/index.html','robots.txt','sitemap.xml','llms.txt','.well-known/commerce.json','manifest.webmanifest']) {
    if (!fs.existsSync(path.join(ROOT, 'compiled', 'website', file))) throw new Error(`missing ${file}`);
  }
});
check('MTG brand boundary is correct', () => {
  const shop = fs.readFileSync(path.join(ROOT, 'compiled', 'website', 'shop', 'index.html'), 'utf8');
  const mtg = fs.readFileSync(path.join(ROOT, 'compiled', 'website', 'mtg', 'index.html'), 'utf8');
  if (!shop.includes('HAPPYHOMARID MASTER SELLERS')) throw new Error('HappyHomarid brand missing');
  if (!mtg.includes('HAPPYHOMARID MASTER SELLERS')) throw new Error('MTG silo brand missing');
});

const failed = results.filter(r => r.status === 'FAIL');
const output = { status: failed.length ? 'FAIL' : 'PASS', product_count: catalog?.products?.length || 0, tests: results };
console.log(JSON.stringify(output, null, 2));
process.exitCode = failed.length ? 1 : 0;
