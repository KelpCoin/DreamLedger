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

function fail(message) {
  console.error('STOREFRONT_UX_GATE_FAILED: ' + message);
  process.exitCode = 1;
}

async function main() {
  const home = await get('/');
  if (home.status !== 200) fail('homepage status ' + home.status);

  const html = home.body;
  const required = [
    ['DreamLedger', /DreamLedger/i],
    ['DreamMee', /DreamMee/i],
    ['catalogue headline', /FIND SOMETHING/i],
    ['catalogue prompt', /Swipe sideways/i],
    ['new rail', /id="new"/i],
    ['magic rail', /id="magic"/i],
    ['digital section', /id="digital"/i],
    ['horizontal rails', /class="rail"/i],
    ['billboard module', /Pioneer product/i],
    ['billboard route', /href="\/billboard"/i]
  ];

  for (const [label, pattern] of required) {
    if (!pattern.test(html)) fail('missing ' + label + ' on homepage');
  }

  const forbidden = [
    'Gauntlet',
    'Economic Court',
    'Truth Oracle',
    'ELOHIM',
    'BrownEye Cortex',
    'BEC-PRIME',
    'AMPLISSA',
    'COLLECTORSCOAST',
    'SUPABASE_SERVICE_ROLE',
    'STRIPE_SECRET',
    'STRIPE_WEBHOOK',
    'RA_000001',
    'agentic commerce',
    'capital authority'
  ];

  for (const token of forbidden) {
    if (html.toLowerCase().includes(token.toLowerCase())) fail('forbidden public copy: ' + token);
  }

  const products = await get('/api/products');
  if (products.status !== 200) fail('/api/products status ' + products.status);

  let parsed = null;
  try {
    parsed = JSON.parse(products.body);
  } catch (error) {
    fail('/api/products returned invalid JSON: ' + error.message);
  }

  if (parsed && !Array.isArray(parsed.products)) {
    fail('/api/products JSON has no products[] array');
  }

  const proof = {
    status: process.exitCode ? 'FAIL' : 'PASS',
    timestamp_utc: new Date().toISOString(),
    homepage_status: home.status,
    products_status: products.status,
    required_markers: required.map(([label]) => label),
    forbidden_public_copy_checked: forbidden,
    products_json_valid: parsed !== null
  };

  console.log(JSON.stringify(proof, null, 2));
  if (process.exitCode) process.exit(1);
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
