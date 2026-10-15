'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'docs/commerce/commerce-sku-contract.v1.json'), 'utf8'));
const shared = fs.readFileSync(path.join(root, 'supabase/functions/_shared/commerce-sku-contract.ts'), 'utf8');
const webhook = fs.readFileSync(path.join(root, 'supabase/functions/stripe-revenue-41104f355d6878cdd6d1f9dc/index.ts'), 'utf8');
const intake = fs.readFileSync(path.join(root, 'supabase/functions/marketplace-diagnostic-input/index.ts'), 'utf8');
const producer = fs.readFileSync(path.join(root, 'api/stripe-link.ts'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/commerce-sku-contract.yml'), 'utf8');
const failures = [];
function need(ok, message) { if (!ok) failures.push(message); }
need(contract.schema === 'dreamledger/commerce-sku-contract/v1', 'contract schema must be pinned');
need(JSON.stringify(contract.allowed_metadata_keys) === JSON.stringify(['sku_id','sku','marketplace_listing_id']), 'allowed identifiers must be exhaustive and in priority order');
need(JSON.stringify(contract.key_priority) === JSON.stringify(contract.allowed_metadata_keys), 'key_priority must match allowed_metadata_keys');
need(contract.offer_mappings['CMD-DIAG-29'] === 'COMMANDER-DECK-DIAGNOSTIC-001', 'Commander mapping must be pinned');
need(contract.known_canonical_skus.includes('COMMANDER-DECK-DIAGNOSTIC-001'), 'canonical Commander SKU must be known');
need(contract.known_canonical_skus.includes('TOLL-PROBE-50C'), 'known TOLL probe SKU must remain explicitly registered');
need(shared.includes('COMMERCE_SKU_CONTRACT.key_priority') && shared.includes('normalizeCanonicalSku') && shared.includes('resolveCanonicalSku'), 'one shared resolver must implement the contract');
need(webhook.includes('resolveCanonicalSku(metadata)') && webhook.includes('SKU_CONTRACT_VIOLATION'), 'settlement handler must resolve and fail closed');
need(!webhook.includes('metadata.dreamledger_sku'), 'settlement handler must never treat dreamledger_sku as product identity');
need(webhook.includes('_commerce_sku_contract') && webhook.includes('metadata_before') && webhook.includes('metadata_after'), 'event-level SKU evidence fossil fields must exist');
need(webhook.indexOf('.from("revenue_catalog")') < webhook.indexOf('marketplace_settle_stripe_payment'), 'catalogue check must precede marketplace settlement side effect');
need(webhook.indexOf('.from("skus")') < webhook.indexOf('marketplace_settle_stripe_payment'), 'authoritative SKU registry check must precede marketplace settlement side effect');
need(intake.includes('resolveCanonicalSku(metadata)') && !intake.includes('metadata.dreamledger_sku'), 'diagnostic intake must use the shared canonical resolver only');
need(producer.includes("import { COMMERCE_SKU_CONTRACT, normalizeCanonicalSku }") && producer.includes("form.set('metadata[sku_id]', canonicalSku)"), 'checkout producer must use contract and emit sku_id');
need(producer.includes("form.set('payment_intent_data[metadata][sku_id]', canonicalSku)"), 'PaymentIntent metadata must carry canonical SKU');
need(!producer.includes('\\n') && !producer.includes('metadata][product_sku]'), 'checkout producer must not retain malformed literal newlines or legacy identifier');
need(workflow.includes('npm run verify:commerce-sku-contract'), 'CI must run this verifier');
function resolve(metadata) {
  for (const key of contract.key_priority) {
    if (typeof metadata[key] !== 'string' || !metadata[key].trim()) continue;
    const raw = metadata[key].trim();
    return { key, raw, value: key === 'marketplace_listing_id' ? raw : (contract.offer_mappings[raw] || raw) };
  }
  return null;
}
assert.equal(resolve({sku:'secondary',sku_id:'primary'}).key,'sku_id');
assert.equal(resolve({sku:' secondary '}).value,'secondary');
assert.equal(resolve({dreamledger_sku:'legacy-only'}),null);
assert.equal(resolve({marketplace_listing_id:'listing_123'}).key,'marketplace_listing_id');
assert.equal(resolve({sku_id:'CMD-DIAG-29'}).value,'COMMANDER-DECK-DIAGNOSTIC-001');
console.log('COMMERCE_SKU_CONTRACT=' + (failures.length ? 'FAIL' : 'PASS'));
failures.forEach(f => console.error('FAIL: ' + f));
console.log('contract_checks=17; resolver_cases=5');
if (failures.length) process.exit(1);
