import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const source = path.join(root, 'BEC-PRIME', 'silos', 'SILO_DREAMIEZ', 'source', 'dreamiez-unified.html');
const compiled = path.join(root, 'BEC-PRIME', 'compiled', 'website', 'dreamiez-unified.html');

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`missing file: ${path.relative(root, file)}`);
  return fs.readFileSync(file, 'utf8');
}

const sourceHtml = read(source);
const compiledHtml = read(compiled);
const required = [
  'BUILD4_MARKER: dreamiez-unified-v1',
  '/api/dreamiez/me',
  '/api/dreamiez/cosmetics',
  '/api/dreamiez/cosmetics/claim',
  '/api/products/BEC-PRIME-ARCHITECTURE-AUDIT-001',
  '/api/offer-checkout/create',
  'checkout_url',
  'BUILD4 / UNIFIED RUNTIME'
];

for (const marker of required) {
  if (!sourceHtml.includes(marker)) throw new Error(`source marker missing: ${marker}`);
  if (!compiledHtml.includes(marker)) throw new Error(`compiled marker missing: ${marker}`);
}

if (/alert\(['"]Paid cosmetics checkout is being connected/i.test(compiledHtml)) {
  throw new Error('compiled runtime still contains the old fake paid-cosmetics placeholder');
}
if (/payment.{0,40}(success|complete|confirmed)/i.test(compiledHtml)) {
  throw new Error('compiled runtime contains an unsupported payment-success claim');
}

const result = {
  status: 'PASS',
  build: 'BUILD4',
  runtime: 'dreamiez-unified-v1',
  source: path.relative(root, source).replaceAll('\\', '/'),
  compiled: path.relative(root, compiled).replaceAll('\\', '/'),
  identity_endpoint: '/api/dreamiez/me',
  cosmetics_endpoint: '/api/dreamiez/cosmetics',
  checkout_endpoint: '/api/offer-checkout/create',
  payment_truth: 'external_webhook_only',
  revenue_claim: false,
  source_and_compiled_present: true,
  required_markers: required.length
};

console.log(JSON.stringify(result, null, 2));
