'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'docs/commerce/commerce-sku-contract.v1.json'), 'utf8'));
const webhook = fs.readFileSync(path.join(root, 'supabase/functions/stripe-revenue-41104f355d6878cdd6d1f9dc/index.ts'), 'utf8');
const intake = fs.readFileSync(path.join(root, 'supabase/functions/marketplace-diagnostic-input/index.ts'), 'utf8');
const failures = [];
function need(ok, message) { if (!ok) failures.push(message); }
need(contract.schema === 'dreamledger/commerce-sku-contract/v1', 'contract schema must be pinned');
need(JSON.stringify(contract.allowed_metadata_keys) === JSON.stringify(['sku_id', 'sku', 'marketplace_listing_id']), 'allowed metadata keys and priority must be exact');
need(contract.offer_mappings['CMD-DIAG-29'] === 'COMMANDER-DECK-DIAGNOSTIC-001', 'Commander offer mapping must be pinned');
need(webhook.includes('resolveCanonicalSku') && webhook.includes('SKU_CONTRACT_VIOLATION'), 'settlement handler must enforce fail-closed canonical SKU resolution');
need(!webhook.includes('metadata.dreamledger_sku'), 'settlement handler must not use dreamledger_sku as product identity');
need(!intake.includes('metadata.dreamledger_sku'), 'diagnostic intake must not use dreamledger_sku as product identity');
need(intake.includes('metadata.sku_id || metadata.sku || metadata.marketplace_listing_id'), 'intake must resolve only allowed metadata keys');
if (failures.length) {
  console.error('COMMERCE_SKU_CONTRACT=FAIL');
  failures.forEach((failure) => console.error('FAIL: ' + failure));
  process.exit(1);
}
console.log('COMMERCE_SKU_CONTRACT=PASS');
console.log('checks=7');
