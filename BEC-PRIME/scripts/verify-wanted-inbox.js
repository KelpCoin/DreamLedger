'use strict';

const fs = require('fs');
const path = require('path');
const wanted = require('../routes/wanted');

const cases = [
  {
    text: 'FUBU jacket XL or 2XL vintage 1990s black or red under NZ$120',
    expect: { brand: 'FUBU', size: 'XL, 2XL', max_price: 120, currency: 'NZD' }
  },
  {
    text: 'oversized vintage Nike jacket 2XL under $150',
    expect: { brand: 'Nike', size: '2XL', max_price: 150 }
  }
];

const results = cases.map(test => {
  const got = wanted.parseWantedText(test.text);
  const pass = Object.keys(test.expect).every(key => got[key] === test.expect[key]);
  return { pass, text: test.text, got, expect: test.expect };
});

const routePass = typeof wanted.handle === 'function';
const storeDir = path.dirname(wanted.DATA_FILE);
const report = {
  proof: 'WANTED-INBOX-V1',
  timestamp: new Date().toISOString(),
  route_export: routePass ? 'PASS' : 'FAIL',
  parser_cases: results,
  store_path: wanted.DATA_FILE,
  verdict: routePass && results.every(r => r.pass) ? 'PASS' : 'FAIL'
};

const proofPath = path.join(__dirname, '..', 'PROOF-WANTED-INBOX-V1.json');
fs.mkdirSync(storeDir, { recursive: true });
fs.writeFileSync(proofPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
if (report.verdict !== 'PASS') process.exit(1);
