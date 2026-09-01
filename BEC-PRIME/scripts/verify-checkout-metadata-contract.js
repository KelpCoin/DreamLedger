'use strict';

/* Behavioral Checkout metadata gate.
 * Detects direct Stripe Checkout Session POSTs, checkout-session helper wrappers,
 * and raw Stripe /v1/checkout/sessions calls. It requires the producer to attach
 * payment_intent_data metadata for the canonical commerce identity fields.
 * Read-only retrieval of Checkout Sessions is intentionally ignored.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage']);
const EXT = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx']);
const REQUIRED = ['product_sku', 'product_id', 'offer_id', 'silo', 'source'];
const PRODUCER = /(checkout\/sessions|checkout\.sessions|v1\/checkout\/sessions)/i;
const POST = /\b(?:method\s*:\s*['"]POST['"]|\.post\s*\()/i;
const READ = /\b(?:GET|list|retrieve)\b/i;
const META = /payment_intent_data(?:\[[^\]]+\])*metadata|payment_intent_data[\s\S]{0,1200}metadata/i;
const RAW_STRIPE = /https:\/\/api\.stripe\.com\/v1\/checkout\/sessions/i;

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

function windows(text) {
  const hits = [];
  const re = new RegExp(PRODUCER.source, 'gi');
  let m;
  while ((m = re.exec(text))) hits.push(text.slice(Math.max(0, m.index - 1800), Math.min(text.length, m.index + 2200)));
  return hits;
}

const failures = [];
for (const file of walk(ROOT)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const w of windows(text)) {
    const rawPost = RAW_STRIPE.test(w) && POST.test(w);
    const checkoutCall = PRODUCER.test(w) && !READ.test(w);
    if (!rawPost && !checkoutCall) continue;
    if (!META.test(w)) {
      failures.push({ file: path.relative(ROOT, file), reason: 'Checkout producer lacks payment_intent_data.metadata' });
      continue;
    }
    for (const field of REQUIRED) {
      if (!new RegExp('metadata[^\\n]{0,300}' + field, 'i').test(w) && !new RegExp(field + '[^\\n]{0,300}metadata', 'i').test(w)) {
        failures.push({ file: path.relative(ROOT, file), reason: 'Checkout producer metadata missing ' + field });
      }
    }
  }
}

console.log('CHECKOUT_METADATA_CONTRACT');
console.log('root=' + ROOT);
console.log('required=' + REQUIRED.join(','));
if (failures.length) {
  for (const f of failures) console.error('FAIL ' + f.file + ': ' + f.reason);
  console.error('STATUS=FAIL');
  process.exit(1);
}
console.log('STATUS=PASS');
