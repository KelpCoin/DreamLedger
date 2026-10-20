'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { render, validHttpsUrl } = require('./render-silo-growth-promo.js');

test('unverified or missing support destination renders nothing', () => {
  assert.equal(render({ silo_id: 'mtg', creator_support: { destination_url: null, destination_status: 'UNVERIFIED' } }), '');
  assert.equal(render({ silo_id: 'books' }), '');
  assert.equal(render({ silo_id: 'music', creator_support: { destination_url: 'http://example.com', destination_status: 'VERIFIED' } }), '');
});
test('verified HTTPS destination renders an optional accessible card', () => {
  const html = render({ silo_id: 'mtg', creator_support: { destination_url: 'https://example.com/support', destination_status: 'VERIFIED', label: 'Support Happy Homarid', description: 'Optional original writing support.' } });
  assert.match(html, /data-silo-support="optional"/);
  assert.match(html, /data-silo-id="mtg"/);
  assert.match(html, /Support Happy Homarid/);
  assert.match(html, /https:\/\/example\.com\/support/);
  assert.match(html, /rel="noopener noreferrer"/);
});
test('rejects unsafe schemes and validates HTTPS', () => {
  assert.equal(render({ silo_id: 'x', creator_support: { destination_url: 'javascript:alert(1)', destination_status: 'VERIFIED' } }), '');
  assert.equal(validHttpsUrl('https://example.com'), true);
  assert.equal(validHttpsUrl('javascript:alert(1)'), false);
});
