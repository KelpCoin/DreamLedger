'use strict';

/* Behavioral Checkout metadata gate.
 * Finds code that can POST to Stripe Checkout Sessions, including raw fetch
 * calls and helper-based producers. Read-only retrievals are not producers.
 * The runtime contract is centralized in commercePaymentContractPreload.js,
 * which augments every outbound Checkout POST before it reaches Stripe.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage']);
const EXT = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx']);
const REQUIRED = ['product_sku', 'product_id', 'offer_id', 'silo', 'source'];
const CHECKOUT = /(checkout\/sessions|checkout\.sessions|v1\/checkout\/sessions)/i;
const RAW_STRIPE = /https:\/\/api\.stripe\.com\/v1\/checkout\/sessions/i;
const POST = /(?:method\s*:\s*['"]POST['"]|\.post\s*\(|POST\s+['"]|fetch\s*\()/i;
const READ_ONLY = /(?:GET\s+|method\s*:\s*['"]GET['"]|\.get\s*\(|list\s*\(|retrieve\s*\()/i;
const PRELOAD = path.join(__dirname, '..', 'lib', 'commercePaymentContractPreload.js');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.has(path.extname(name).toLowerCase())) out.push(p);
  }
  return out;
}
function hasProducerContext(text, index) {
  const w = text.slice(Math.max(0, index - 2500), Math.min(text.length, index + 2500));
  if (RAW_STRIPE.test(w) && POST.test(w)) return true;
  if (!POST.test(w)) return false;
  if (READ_ONLY.test(w) && !/method\s*:\s*['"]POST['"]/.test(w)) return false;
  return true;
}

const producers = [];
for (const file of walk(ROOT)) {
  const text = fs.readFileSync(file, 'utf8');
  const re = new RegExp(CHECKOUT.source, 'gi');
  let m;
  while ((m = re.exec(text))) {
    if (hasProducerContext(text, m.index)) {
      producers.push(path.relative(ROOT, file));
      break;
    }
  }
}

const failures = [];
if (!fs.existsSync(PRELOAD)) failures.push('central runtime contract preload is missing');
else {
  const contract = fs.readFileSync(PRELOAD, 'utf8');
  if (!/payment_intent_data\[metadata\]/.test(contract)) failures.push('runtime patch does not write payment_intent_data metadata');
  for (const field of REQUIRED) {
    if (!new RegExp('payment_intent_data\\[metadata\\]\\[' + field + '\\]').test(contract)) failures.push('runtime patch missing field: ' + field);
  }
  if (!/api\\\.stripe\\\.com\\/v1\\/checkout\\/sessions/.test(contract)) failures.push('runtime patch does not guard raw Stripe Checkout URL');
}

const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
if (!String(packageJson.scripts?.start || '').includes('commercePaymentContractPreload.js')) failures.push('package start does not preload commercePaymentContractPreload.js');

console.log('CHECKOUT_METADATA_CONTRACT');
console.log('producers=' + [...new Set(producers)].sort().join(','));
console.log('required=' + REQUIRED.join(','));
if (failures.length) {
  for (const f of failures) console.error('FAIL ' + f);
  console.error('STATUS=FAIL');
  process.exit(1);
}
console.log('STATUS=PASS');
