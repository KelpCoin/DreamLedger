'use strict';

const assert = require('node:assert/strict');
const { normalizeMarketplaceSku } = require('../routes/commercialCell');

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
