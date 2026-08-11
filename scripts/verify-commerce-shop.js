const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const branchFiles = {
  feePolicy: path.join(ROOT, 'BEC-PRIME', 'config', 'marketplace-fees.json'),
  auctionPolicy: path.join(ROOT, 'BEC-PRIME', 'config', 'landing-auctions.json'),
  proof: path.join(ROOT, 'BEC-PRIME', 'PROOF-2026-08-12-FEE-AUCTION-POLICY.json'),
  shop: path.join(ROOT, 'BEC-PRIME', 'compiled', 'website', 'shop', 'next.html'),
  feeHelper: path.join(ROOT, 'BEC-PRIME', 'catalog', 'marketplace-policy.js')
};

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function exists(file) { assert.ok(fs.existsSync(file), `missing ${path.relative(ROOT, file)}`); }

Object.values(branchFiles).forEach(exists);
const fees = read(branchFiles.feePolicy);
const auctions = read(branchFiles.auctionPolicy);
const proof = read(branchFiles.proof);
const shop = fs.readFileSync(branchFiles.shop, 'utf8');
const feeHelper = require(branchFiles.feeHelper);

assert.strictEqual(fees.happyhomarid_master_sellers_fee_bps, 0);
assert.strictEqual(fees.default_platform_fee_bps, 500);
assert.strictEqual(fees.payment_rail, 'Stripe');
assert.strictEqual(fees.crypto_payments, false);
assert.strictEqual(feeHelper.getPlatformFeeBps('HappyHomarid Master Sellers', 'SILO_MTG'), 0);
assert.strictEqual(feeHelper.getPlatformFeeBps('OTHER_SELLER', 'SILO_MTG'), 500);
assert.strictEqual(feeHelper.calculateFee(10000, 'HappyHomarid Master Sellers', 'SILO_MTG'), 0);
assert.strictEqual(feeHelper.calculateFee(10000, 'OTHER_SELLER', 'SILO_MTG'), 500);
assert.strictEqual(auctions.slots, 3);
assert.strictEqual(auctions.minimum_distinct_end_times, 3);
assert.strictEqual(auctions.approval_required, true);
assert.strictEqual(proof.seller_policy['HappyHomarid Master Sellers'], '0% platform fee');
assert.strictEqual(proof.seller_policy.other_approved_sellers, '5% platform fee');
assert.ok(shop.includes('HAPPYHOMARID'));
assert.ok(shop.includes('/api/auctions?silo=SILO_MTG'));
assert.ok(shop.includes('/api/offers'));
assert.ok(shop.includes('STRIPE / CARD PAYMENTS ONLY'));
assert.ok(!shop.includes('Collector\'s Curse'));
assert.ok(!shop.includes('Collector\'s Coast'));
assert.ok(!shop.includes('Collectless'));

console.log('PASS commerce shop policy smoke test');
console.log('PASS HappyHomarid MTG platform fee = 0 bps');
console.log('PASS other approved sellers platform fee = 500 bps');
console.log('PASS three auction slots configured');
console.log('PASS Stripe-only / crypto-disabled policy');
console.log('PASS excluded MTG branding absent from shop surface');
