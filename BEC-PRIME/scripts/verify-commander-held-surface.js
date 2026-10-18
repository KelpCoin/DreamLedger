'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push({ name, status: 'PASS' });
    console.log('[PASS] ' + name);
  } catch (error) {
    console.error('[FAIL] ' + name + ': ' + error.message);
    process.exitCode = 1;
  }
}

const product = JSON.parse(read('BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json'));
const productPage = read('public/products/commander-deck-diagnostic-001/index.html');
const portfolioPage = read('public/portfolio/commander-deck-diagnostic.html');
const publicServer = read('public/server.js');
const beckServer = read('BEC-PRIME/start.js');
const publicHome = read('public/index.html');
const publicGuide = read('public/commander-guide.html');
const mvpRoutes = read('BEC-PRIME/routes/mvpRoutes.js');

check('canonical Commander SKU stays held and unsellable', () => {
  assert.equal(product.status, 'held');
  assert.equal(product.checkout?.mode, 'disabled');
  assert.equal(product.commercial_truth?.sellable, false);
  assert.equal(product.fulfillment?.mode, 'disabled');
});

check('public /buy URL resolves to the canonical held-status page', () => {
  assert.match(publicServer, /['"]\/buy\/COMMANDER-DECK-DIAGNOSTIC-001['"]\s*:\s*'products\/commander-deck-diagnostic-001\/index\.html'/);
  assert.match(publicServer, /['"]\/buy\/COMMANDER-DECK-DIAGNOSTIC-001\/['"]\s*:\s*'products\/commander-deck-diagnostic-001\/index\.html'/);
  assert.match(publicServer, /['"]\/products\/commander-deck-diagnostic-001\/index\.html['"]\s*:\s*'products\/commander-deck-diagnostic-001\/index\.html'/);
});

check('BECK legacy purchase aliases resolve to the held diagnostic surface', () => {
  assert.match(beckServer, /['"]\/buy\/COMMANDER-DECK-DIAGNOSTIC-001['"]\s*:\s*'mtg\/diagnostic\.html'/);
  assert.match(beckServer, /['"]\/products\/commander-deck-diagnostic-001\/index\.html['"]\s*:\s*'mtg\/diagnostic\.html'/);
  assert.match(beckServer, /['"]\/buy\/COMMANDER-DECK-DIAGNOSTIC-001\/['"]\s*:\s*'mtg\/diagnostic\.html'/);
});

check('Commander QR route does not send visitors to Stripe', () => {
  const qrLine = beckServer.split('\n').find((line) => line.includes("'/q/cmd-diag'"));
  assert.ok(qrLine, 'Commander QR redirect entry must exist');
  assert.match(qrLine, /dreamledger\.org\/products\/commander-deck-diagnostic-001\/index\.html/);
  assert.doesNotMatch(qrLine, /buy\.stripe\.com|checkout\.stripe\.com/i);
});

check('Commander public pages explicitly state held status and expose no Stripe link', () => {
  for (const [name, html] of [['product page', productPage], ['portfolio page', portfolioPage]]) {
    assert.match(html, /currently held|not available for purchase/i, name + ' missing held notice');
    assert.doesNotMatch(html, /buy\.stripe\.com|checkout\.stripe\.com/i, name + ' contains live Stripe destination');
  }
});

check('legacy public homepage and Commander guide no longer advertise live checkout', () => {
  assert.doesNotMatch(publicHome, /href=["']\/buy\/COMMANDER-DECK-DIAGNOSTIC-001["']/i);
  assert.match(publicHome, /Not available for purchase/);
  assert.doesNotMatch(publicGuide, /href=["']\/buy\/COMMANDER-DECK-DIAGNOSTIC-001["']/i);
  assert.match(publicGuide, /currently held|not available for purchase/i);
});

check('server-side product gate refuses held Commander checkout', () => {
  assert.match(mvpRoutes, /function checkoutableProduct\(productId\)/);
  assert.match(mvpRoutes, /p\.status !== 'published'/);
  assert.match(mvpRoutes, /Product is not approved and checkoutable/);
});

if (process.exitCode) {
  console.error(JSON.stringify({ schema: 'DREAMLEDGER/COMMANDER-HELD-SURFACE-CHECK/v1', checks, verdict: 'FAIL' }, null, 2));
} else {
  console.log(JSON.stringify({ schema: 'DREAMLEDGER/COMMANDER-HELD-SURFACE-CHECK/v1', checks, verdict: 'PASS' }, null, 2));
}
