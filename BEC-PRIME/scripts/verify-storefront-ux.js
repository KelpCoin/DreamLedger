'use strict';

const http = require('http');
const PORT = Number(process.env.PORT || 4173);
const BASE = 'http://127.0.0.1:' + PORT;
function get(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get(BASE + pathname, { headers: { 'cache-control': 'no-cache' } }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('timeout: ' + pathname)));
  });
}

async function main() {
  const home = await get('/');
  if (home.status !== 200) throw new Error('homepage status ' + home.status);
  const html = home.body;
  const required = [
    ['DreamLedger brand', /DreamLedger/i],
    ['evidence-first commerce positioning', /Evidence-first commerce/i],
    ['homepage headline', /Make the next decision\s*<span>easier to prove/i],
    ['Truth Oracle evidence review link', /href="\/truth-oracle\.html/i],
    ['free worksheet route', /href="(?:https:\/\/dreamledger\.org)?\/quote-comparison\//i],
    ['trust route', /href="\/trust\//i]
  ];
  for (const [label, pattern] of required) {
    if (!pattern.test(html)) throw new Error('missing ' + label + ' on homepage');
  }

  const forbidden = [
    'Gauntlet', 'Economic Court', 'ELOHIM', 'BrownEye Cortex',
    'AMPLISSA', 'COLLECTORSCOAST', 'SUPABASE_SERVICE_ROLE',
    'STRIPE_SECRET', 'STRIPE_WEBHOOK', 'RA_000001'
  ];
  for (const token of forbidden) {
    if (html.toLowerCase().includes(token.toLowerCase())) {
      throw new Error('forbidden public copy: ' + token);
    }
  }

  const products = await get('/api/products');
  if (products.status !== 200) throw new Error('/api/products status ' + products.status);
  let parsed;
  try { parsed = JSON.parse(products.body); }
  catch (error) { throw new Error('/api/products returned invalid JSON: ' + error.message); }
  if (!parsed || !Array.isArray(parsed.products)) {
    throw new Error('/api/products JSON has no products[] array');
  }
  const published = parsed.products.filter(product => product && product.status === 'published');
  const purchasable = published.filter(product =>
    (product.checkout_available === true && typeof product.checkout_url === 'string' && (/^https:\/\//i.test(product.checkout_url) || /^\/(?!\/)/.test(product.checkout_url))) ||
    (product.sale_mode === 'claim_by_message' && typeof product.claim_url === 'string' && (/^https:\/\//i.test(product.claim_url) || /^\/(?!\/)/.test(product.claim_url) || /^mailto:hello@dreamledger\.org(?:\?.*)?$/i.test(product.claim_url)))
  );
  const brokenCheckout = published.filter(product =>
    product.checkout_available === true && !(typeof product.checkout_url === 'string' && /^https:\/\//i.test(product.checkout_url))
  );
  const brokenClaim = published.filter(product =>
    product.sale_mode === 'claim_by_message' && !(typeof product.claim_url === 'string' && (/^https:\/\//i.test(product.claim_url) || /^\/(?!\/)/.test(product.claim_url) || /^mailto:hello@dreamledger\.org(?:\?.*)?$/i.test(product.claim_url)))
  );
  if (brokenCheckout.length) {
    throw new Error('checkout-enabled products missing valid checkout URL: ' + brokenCheckout.map(product => product.id).join(', '));
  }
  if (brokenClaim.length) {
    throw new Error('claim-by-message products missing valid claim URL: ' + brokenClaim.map(product => product.id).join(', '));
  }
  if (!purchasable.length) {
    throw new Error('no published product has a valid checkout or claim route');
  }

  console.log(JSON.stringify({
    status: 'PASS',
    timestamp_utc: new Date().toISOString(),
    homepage_status: home.status,
    products_status: products.status,
    required_markers: required.map(item => item[0]),
    forbidden_public_copy_checked: forbidden,
    published_products: published.length,
    buyable_published_products: published.filter(product => product.checkout_available === true).length,
    claimable_published_products: published.filter(product => product.sale_mode === 'claim_by_message' && typeof product.claim_url === 'string').length,
    products_json_valid: true
  }, null, 2));
}

main().catch(error => {
  console.error('STOREFRONT_UX_GATE_FAILED: ' + (error.stack || error.message));
  process.exit(1);
});
