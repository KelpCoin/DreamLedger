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

const substitutions = [
  ['data-silo="mtg"','data-silo="untrusted"'],
  ['dreamledger-mtg-theme.css','unverified-theme.css'],
  ['id="deckRail"','id="badRail"'],
  ['id="singleRail"','id="badSingles"'],
  ['/data/mtg-catalog.json','/data/other-catalog.json'],
  ['/catalog.json','/other-catalog.json'],
  ['/data/mtg-owner-decks.json','/data/other-decks.json'],
  ['checkout_verified:false','checkout_verified:true'],
  ['p.checkout_verified===true','p.checkout_verified!==true'],
  ['Checkout is available only for confirmed stock.','Every item is available for checkout.']
];
const rejected = substitutions.map(([from,to],i)=>{
  assert.ok(code.includes(from),'fixture source drift '+i+': '+from);
  return code.replace(from,to);
});
rejected.push(
  code+"\\nwindow.location.assign(data.checkout_url)",
  code+"\\nfetch('/api/offer-checkout/create'",
  code+"\\ncheckout_verified:true",
  code+"\\ndata-dreamledger-mtg-commerce-v2"
);
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
