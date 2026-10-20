'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', '..', 'public', 'terms.html');
const html = fs.readFileSync(file, 'utf8');
const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').toLowerCase();

assert.match(text, /refunds? for change of mind/);
assert.match(text, /consumer guarantees act 1993/);
assert.match(text, /not supplied/);
assert.match(text, /not as described/);
assert.match(text, /remedy required by law/);
assert.match(text, /statutory consumer rights/);
assert.doesNotMatch(text, /no refunds under any circumstances/);
assert.doesNotMatch(text, /all sales final under all circumstances/);

console.log('NZ_CONSUMER_REFUND_TERMS=PASS');
