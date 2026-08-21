import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const source = path.join(root, 'BEC-PRIME', 'silos', 'SILO_DREAMIEZ', 'source', 'dreamiez-unified.html');
const compiled = path.join(root, 'BEC-PRIME', 'compiled', 'website', 'dreamiez-unified.html');
const proofDir = path.join(root, 'BEC-PRIME', 'proof');
const proofFile = path.join(proofDir, 'dreamiez-build4-proof.json');

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`missing file: ${path.relative(root, file)}`);
  return fs.readFileSync(file, 'utf8');
}

const sourceHtml = read(source);
const compiledHtml = read(compiled);
const sourceRequired = [
  'BUILD4_MARKER: dreamiez-unified-v1',
  '/api/dreamiez/me',
  '/api/dreamiez/cosmetics',
  '/api/dreamiez/cosmetics/claim',
  '/api/products/BEC-PRIME-ARCHITECTURE-AUDIT-001',
  '/api/offer-checkout/create',
  'checkout_url',
  'Build 4 / unified runtime'
];
const compiledRequired = [
  'BUILD4_MARKER: dreamiez-unified-v1',
  '/api/dreamiez/me',
  '/api/dreamiez/cosmetics',
  '/api/dreamiez/cosmetics/claim',
  '/api/products/BEC-PRIME-ARCHITECTURE-AUDIT-001',
  '/api/offer-checkout/create',
  'checkout_url',
  'BUILD4 / UNIFIED RUNTIME'
];

for (const marker of sourceRequired) {
  if (!sourceHtml.includes(marker)) throw new Error(`source marker missing: ${marker}`);
}
for (const marker of compiledRequired) {
  if (!compiledHtml.includes(marker)) throw new Error(`compiled marker missing: ${marker}`);
}

if (/alert\(['"]Paid cosmetics checkout is being connected/i.test(compiledHtml)) {
  throw new Error('compiled runtime still contains the old fake paid-cosmetics placeholder');
}
if (/payment\s+(?:success|complete|confirmed)\b/i.test(compiledHtml)) {
  throw new Error('compiled runtime contains an unsupported payment-success claim');
}

const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');
const timestamp = new Date().toISOString();
const result = {
  status: 'PASS',
  build: 'BUILD4',
  runtime: 'dreamiez-unified-v1',
  timestamp,
  source: path.relative(root, source).replaceAll('\\', '/'),
  compiled: path.relative(root, compiled).replaceAll('\\', '/'),
  source_sha256: sha256(sourceHtml),
  compiled_sha256: sha256(compiledHtml),
  identity_endpoint: '/api/dreamiez/me',
  cosmetics_endpoint: '/api/dreamiez/cosmetics',
  checkout_endpoint: '/api/offer-checkout/create',
  payment_truth: 'external_webhook_only',
  revenue_claim: false,
  source_and_compiled_present: true,
  source_required_markers: sourceRequired.length,
  compiled_required_markers: compiledRequired.length
};

fs.mkdirSync(proofDir, { recursive: true });
fs.writeFileSync(proofFile, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(result, null, 2));
console.log(`proof_file=${path.relative(root, proofFile).replaceAll('\\', '/')}`);
