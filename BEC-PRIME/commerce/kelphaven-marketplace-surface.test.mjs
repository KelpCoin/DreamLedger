import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const b2b = await readFile(new URL('../../public/b2b-marketplace.html', import.meta.url), 'utf8');
const a2a = await readFile(new URL('../../public/a2a-marketplace.html', import.meta.url), 'utf8');
const marketplace = await readFile(new URL('../../public/marketplace.html', import.meta.url), 'utf8');
const agentCard = await readFile(new URL('../../public/marketplace/agent-card.json', import.meta.url), 'utf8');

test('customer marketplace surfaces use canonical Kelphaven.n identity', () => {
  assert.match(b2b, /KELPHAVEN<span>\.N<\/span>/);
  assert.match(a2a, /KELPHAVEN\.N/);
  assert.match(marketplace, /<title>Kelphaven\.n \| B2B \+ Agent Marketplace<\/title>/);
  assert.match(agentCard, /"name":"Kelphaven\.n Marketplace"/);
});

test('B2B page reports API failure and does not use implicit named DOM globals', () => {
  assert.match(b2b, /Marketplace service returned HTTP/);
  assert.match(b2b, /No transaction was started/);
  assert.match(b2b, /No RFQ was created/);
  assert.doesNotMatch(b2b, /title:rt\.value|description:rd\.value|category:rc\.value/);
});

test('A2A discovery reports API failure without implying a trade or payment', () => {
  assert.match(a2a, /Marketplace service returned HTTP/);
  assert.match(a2a, /No quote, order or payment was created/);
  assert.match(a2a, /\/m2m\/v1\/marketplace\/search/);
});

test('agent surfaces do not present search/quote discovery as settled commerce', () => {
  assert.match(a2a, /human-authorized/);
  assert.match(marketplace, /settlement and fulfilment are verified/);
});
