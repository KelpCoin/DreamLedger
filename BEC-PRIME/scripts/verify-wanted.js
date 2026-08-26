'use strict';
const assert = require('assert');
const { parseWantedText } = require('../routes/wanted');
const { buildEbayQuery } = require('../routes/hunt');

const w = parseWantedText('FUBU jacket 2XL black vintage 1990s under NZ$150');
assert.strictEqual(w.brand, 'FUBU');
assert.strictEqual(w.size, '2XL');
assert.strictEqual(w.max_price, 150);
assert.strictEqual(w.currency, 'NZD');
assert.ok(w.style.includes('vintage'));
assert.ok(w.colour.includes('black'));
assert.ok(buildEbayQuery(w).includes('FUBU'));
assert.ok(buildEbayQuery(w).includes('2XL'));
console.log('WANTED_VERIFY=PASS');
console.log('PARSER=PASS');
console.log('EBAY_QUERY_BUILDER=PASS');
