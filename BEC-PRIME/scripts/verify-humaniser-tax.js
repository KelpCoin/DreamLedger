'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tax = require('../lib/taxLedger');

const root = path.join(__dirname, '..');
const humaniser = fs.readFileSync(path.join(root, 'autonomy', 'Humaniser.ps1'), 'utf8');
assert.ok(humaniser.includes('human_signatures'), 'Humaniser must inspect human_signatures');
assert.ok(humaniser.includes("$signatures.Count -lt 2"), 'Humaniser must fail closed below two signatures');
assert.ok(humaniser.includes("status='WAITING'"), 'Humaniser must quarantine incomplete assets');
assert.ok(humaniser.includes("status='PASS'"), 'Humaniser must permit two-footprint assets');
const gst = tax.gstFromInclusiveGross(1500, 0.15);
assert.strictEqual(gst, 196, 'NZD 15.00 inclusive GST at 15% should be NZD 1.96');
const tag = tax.buildTaxTag({ amountTotalMinor: 4900, currency: 'nzd', productId: 'AGENTIC-COMMERCE-READINESS-001', silo: 'commerce' });
assert.strictEqual(tag.gst_amount_minor, 639, 'NZD 49.00 inclusive GST at 15% should be NZD 6.39');
assert.strictEqual(tag.gst_treatment, 'inclusive_gross_calculation');
console.log(JSON.stringify({ status: 'PASS', humaniser: 'two-signature fail-closed gate', gst_math: 'PASS', proof: path.join(root, 'PROOF-HUMANISER-TAX-LEDGER.json') }, null, 2));
