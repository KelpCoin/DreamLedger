'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'BEC-PRIME/website/mtg-catalog.html');
const patcher = path.join(root, 'BEC-PRIME/scripts/Patch-MTG-CommerceSurface.js');
const code = fs.readFileSync(source, 'utf8');
const before = fs.readFileSync(source);

// Importing the existing compiler patch must never mutate the storefront.
const { isKnownHeldModernDeckGrid } = require(patcher);
assert.equal(fs.readFileSync(source).equals(before), true, 'import changed source');
assert.equal(isKnownHeldModernDeckGrid(code), true, 'known held NZ grid rejected');

const rejected = [
  code.replace('Checkout held until independent reservation and fulfilment proof.', ''),
  code.replace('Boolean(p.checkout_available)===Boolean(m.checkout_available)', ''),
  code.replace("const CATALOG='/data/mtg-catalog.json'", ''),
  code.replace('id="grid"', 'id="arbitrary"'),
  code + "\nwindow.location.assign(data.checkout_url)",
  code + "\nbuy.stripe.com",
  code + "\nfetch('/api/offer-checkout/create'"
];
rejected.forEach((fixture, index) => assert.equal(
  isKnownHeldModernDeckGrid(fixture), false, 'unsafe/unknown fixture ' + index
));

// Run the real patch CLI in the GitHub runner, using the canonical current
// source. It must SKIP the legacy patch, preserve bytes, and not claim checkout.
const child = cp.spawnSync(process.execPath, [patcher], {
  cwd: root, encoding: 'utf8', timeout: 10000
});
assert.equal(child.status, 0, child.stderr || 'legacy patch failed');
assert.match(child.stdout, /MTG_LEGACY_PATCH_SKIPPED_MODERN_TEMPLATE/);
assert.equal(fs.readFileSync(source).equals(before), true, 'CLI changed held source');
const proof = JSON.parse(fs.readFileSync(
  path.join(root, 'BEC-PRIME/PROOF-MTG-COMMERCE-SURFACE.json'), 'utf8'));
assert.equal(proof.checkout_verified, false);
assert.equal(proof.legacy_render_patch_applied, false);
assert.equal(proof.status, 'SKIPPED_MODERN_TEMPLATE_CHECKOUT_UNVERIFIED');
console.log('PASS: modern grid recognized, unknown/unsafe inputs blocked, checkout unverified');
