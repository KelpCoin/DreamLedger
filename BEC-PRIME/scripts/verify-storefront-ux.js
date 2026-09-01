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
    ['DreamLedger', /DreamLedger/i],
    ['avatar accessories headline', /AVATAR ACCESSORIES/i],
    ['digital billboards headline', /DIGITAL BILLBOARDS/i],
    ['avatar outcome', /Make your avatar yours/i],
    ['billboard outcome', /Put your message on a billboard/i],
    ['avatar route', /href="\/avatar"/i],
    ['billboard route', /href="\/billboard"/i],
    ['billboard price', /NZ\$50/i]
  ];

  for (const [label, pattern] of required) {
    if (!pattern.test(html)) throw new Error('missing ' + label + ' on homepage');
  }

  const forbidden = [
    'Gauntlet', 'Economic Court', 'Truth Oracle', 'ELOHIM',
    'BrownEye Cortex', 'BEC-PRIME', 'AMPLISSA', 'COLLECTORSCOAST',
    'SUPABASE_SERVICE_ROLE', 'STRIPE_SECRET', 'STRIPE_WEBHOOK',
    'RA_000001', 'agentic commerce', 'capital authority', 'Dream Ledger Deck'
  ];

  for (const token of forbidden) {
    if (html.toLowerCase().includes(token.toLowerCase())) {
      throw new Error('forbidden public copy: ' + token);
    }
  }

  const products = await get('/api/products');
  if (products.status !== 200) throw new Error('/api/products status ' + products.status);

  let parsed;
  try {
    parsed = JSON.parse(products.body);
  } catch (error) {
    throw new Error('/api/products returned invalid JSON: ' + error.message);
  }

  if (!parsed || !Array.isArray(parsed.products)) {
    throw new Error('/api/products JSON has no products[] array');
  }

  const proof = {
    status: 'PASS',
    timestamp_utc: new Date().toISOString(),
    homepage_status: home.status,
    products_status: products.status,
    required_markers: required.map(([label]) => label),
    forbidden_public_copy_checked: forbidden,
    products_json_valid: true
  };

  console.log(JSON.stringify(proof, null, 2));
}

main().catch(error => {
  console.error('STOREFRONT_UX_GATE_FAILED: ' + (error.stack || error.message));
  process.exit(1);
});
