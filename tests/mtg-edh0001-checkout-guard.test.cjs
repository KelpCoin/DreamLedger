'use strict';
// Review-only deterministic regression: node tests/mtg-edh0001-checkout-guard.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'mtg', 'index.html'), 'utf8');
const match = html.match(/<script>([\\s\\S]*?)<\\/script>/);
assert.ok(match, 'inline storefront script exists');
const script = match[1];
const good = {
  "id": "EDH_0001",
  "status": "published",
  "category": "mtg",
  "price": 400,
  "currency": "nzd",
  "inventory": 1,
  "checkout_available": true,
  "checkout_url": "https://buy.stripe.com/14A3cvea1dSd1DV5oEdwc1J",
  "payment_link_id": "plink_1U6V3BEGgEAnUFF93nnPFUmr",
  "maximum_completed_purchases": 1,
  "shipping_restriction": "NZ",
  "name": "Walk the Plank"
};
async function render(item, mode = 'primary') {
  const elements = { status: { innerHTML: '' }, grid: { innerHTML: '' } };
  const fetch = url => {
    if (mode === 'offline' || (mode === 'legacy' && url === '/catalog.json')) return Promise.reject(new Error('offline'));
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ products: [item] }) });
  };
  vm.runInNewContext(script, { document: { getElementById: id => elements[id] }, fetch });
  assert.doesNotMatch(elements.grid.innerHTML, />Buy deck<\\/a>/, 'initial fallback must not sell');
  for (let i = 0; i < 10; i++) await Promise.resolve();
  return elements.grid.innerHTML;
}
(async () => {
  const cases = [
    ['valid primary', good, true, 'primary'],
    ['wrong price', { ...good, price: 230 }, false, 'primary'],
    ['wrong currency', { ...good, currency: 'usd' }, false, 'primary'],
    ['zero stock', { ...good, inventory: 0 }, false, 'primary'],
    ['extra stock', { ...good, inventory: 2 }, false, 'primary'],
    ['missing stock', { ...good, inventory: undefined }, false, 'primary'],
    ['wrong link', { ...good, checkout_url: 'https://example.invalid' }, false, 'primary'],
    ['wrong link ID', { ...good, payment_link_id: 'other' }, false, 'primary'],
    ['wrong limit', { ...good, maximum_completed_purchases: 2 }, false, 'primary'],
    ['wrong shipping', { ...good, shipping_restriction: 'AU' }, false, 'primary'],
    ['checkout disabled', { ...good, checkout_available: false }, false, 'primary'],
    ['wrong product', { ...good, id: 'EDH_OTHER' }, false, 'primary'],
    ['legacy catalogue', good, false, 'legacy'],
    ['offline catalogue', good, false, 'offline']
  ];
  for (const [label, item, expected, mode] of cases) {
    const markup = await render(item, mode);
    assert.equal(markup.includes('>Buy deck</a>'), expected, label);
  }
  process.stdout.write('PASS ' + cases.length + '/' + cases.length + ' MTG checkout display guards\\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
