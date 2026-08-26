'use strict';

const assert = require('assert');
const {
  buildEbayQuery,
  buildEbayFilter,
  rankCandidates,
  rankCandidate
} = require('../hunt/HuntEngine');

const wanted = {
  id: 'W-proof',
  brand: 'FUBU',
  category: 'jacket',
  size: 'XL, 2XL',
  colour: 'black, red',
  era: '1990s, 2000s',
  style: 'vintage',
  max_price: 120,
  currency: 'NZD'
};

const query = buildEbayQuery(wanted);
assert.ok(query.includes('FUBU'));
assert.ok(query.includes('jacket'));
assert.ok(query.includes('XL'));
assert.ok(query.includes('2XL'));
assert.ok(query.includes('black'));

const filter = buildEbayFilter(wanted);
assert.ok(filter.includes('price:[0..120]'));
assert.ok(filter.includes('FIXED_PRICE'));

const strong = rankCandidate({
  platform: 'fixture',
  title: 'FUBU vintage 1990s jacket 2XL black',
  price: 80,
  currency: 'NZD'
}, wanted);
assert.ok(strong.match_score >= 0.8, 'expected strong fixture match');
assert.strictEqual(strong.verdict, 'STRONG');

const weak = rankCandidate({
  platform: 'fixture',
  title: 'generic blue shirt medium',
  price: 140,
  currency: 'NZD'
}, wanted);
assert.ok(weak.match_score < strong.match_score, 'strong fixture must outrank weak fixture');

const ranked = rankCandidates([
  { platform: 'fixture', title: 'generic blue shirt medium', price: 140, currency: 'NZD' },
  { platform: 'fixture', title: 'FUBU vintage 2000s jacket XL red', price: 70, currency: 'NZD' }
], wanted);
assert.ok(ranked[0].match_score >= ranked[1].match_score);
assert.ok(ranked[0].title.includes('FUBU'));

console.log('HUNT_VERIFY=PASS');
console.log('EBAY_QUERY=PASS');
console.log('EBAY_FILTER=PASS');
console.log('RANKING=PASS');
console.log('ORDERING=PASS');
