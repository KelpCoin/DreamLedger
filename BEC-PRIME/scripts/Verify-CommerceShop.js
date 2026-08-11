'use strict';

const fs = require('fs');
const path = require('path');
const child = require('child_process');

const ROOT = path.join(__dirname, '..');
const catalog = path.join(ROOT, 'catalog', 'evergreen-products.json');
const generator = path.join(ROOT, 'catalog', 'generate-evergreen-products.js');
const shop = path.join(ROOT, 'compiled', 'website', 'shop', 'index.html');
const wall = path.join(ROOT, 'runtime', 'EntitlementWall.js');
const start = path.join(ROOT, 'start.js');

const tests = [];
function test(name, fn) {
  try { fn(); tests.push({ name, status: 'PASS' }); }
  catch (err) { tests.push({ name, status: 'FAIL', error: err.message }); }
}

test('generator exists', () => { if (!fs.existsSync(generator)) throw Error('generator missing'); });
test('shop surface exists', () => { if (!fs.existsSync(shop)) throw Error('shop surface missing'); });
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
  if (data.products.some(x => !x.gauntlet || !x.elohim_role || !x.asymmetric_leverage)) throw Error('leverage/governance metadata missing');
});
test('no public private-goods directory', () => {
  const publicRoot = path.join(ROOT, 'compiled', 'website');
  const privateRoot = path.join(ROOT, 'private-goods');
  if (fs.existsSync(privateRoot) && privateRoot.startsWith(publicRoot)) throw Error('private goods nested under public root');
});

const failed = tests.filter(x => x.status === 'FAIL');
const result = { status: failed.length ? 'FAIL' : 'PASS', tests, generated_count: 100 };
console.log(JSON.stringify(result, null, 2));
process.exitCode = failed.length ? 1 : 0;
