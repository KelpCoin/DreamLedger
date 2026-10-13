'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeMarketplaceSku } = require('../routes/commercialCell');
const commercialCellSource = fs.readFileSync(path.resolve(__dirname, '../routes/commercialCell.js'), 'utf8');
assert.match(commercialCellSource, /const sku = normalizeMarketplaceSku\(/);
const inputFunction = fs.readFileSync(path.resolve(__dirname, '../../supabase/functions/marketplace-diagnostic-input/index.ts'), 'utf8');
const deliveryFunction = fs.readFileSync(path.resolve(__dirname, '../../supabase/functions/marketplace-diagnostic-delivery/index.ts'), 'utf8');
assert.match(inputFunction, /rawSku===\\"CMD-DIAG-29\\"\\?\\"COMMANDER-DECK-DIAGNOSTIC-001\\"/);
assert.match(inputFunction, /session\\.livemode!==true\\|\\|session\\.payment_status!==\\"paid\\"/);
assert.match(inputFunction, /metadata\\?\\.dreamledger_sku\\|\\|session\\.metadata\\?\\.sku_id/);
assert.match(deliveryFunction, /eq\\(\\"checkout_session_id\\",sessionId\\)\\.eq\\(\\"listing_id\\",listingId\\)/);
assert.match(deliveryFunction, /session\\.payment_status!==\\"paid\\"/);

const cases = [
  ['COMMANDER-DECK-DIAGNOSTIC-001', 'COMMANDER-DECK-DIAGNOSTIC-001'],
  ['CMD-DIAG-29', 'COMMANDER-DECK-DIAGNOSTIC-001'],
  ['MTG_CMD_DIAG_001', 'MTG_CMD_DIAG_001'],
  ['OFFER-CMD-DIAG-29-NZD', 'OFFER-CMD-DIAG-29-NZD'],
  ['QUOTE-COMPARE-49', 'QUOTE-COMPARE-49'],
  ['', ''],
];

for (const [input, expected] of cases) {
  assert.equal(normalizeMarketplaceSku(input), expected, 'normalization for ' + input);
}
console.log('PASS: Commander diagnostic aliases normalize to the canonical marketplace listing SKU.');
