'use strict';

const http = require('http');

const PORT = Number(process.env.PORT || 4173);
const BASE = `http://127.0.0.1:${PORT}`;
const APPROVED_CHECKOUT_IDS = new Set([
  'OFFER-CMD-DIAG-29-NZD',
  'EDH_0001'
]);
const FORBIDDEN_PUBLIC = [
  'signal -> offer -> checkout -> proof',
  'shared primitives handle offers',
  'agentic commerce readiness audit',
  'BEC-PRIME-ARCHITECTURE-AUDIT',
  'BEC-SURFACE-AUDIT',
  'CREATOR-AUDIO-LAUNCH-PACK',
  'CRYPTO-WALLET-SECURITY-PACK',
  'Dreamies',
  'ELOHIM',
  'Economic Court',
  'Truth Oracle',
  'Gauntlet',
  'MCP gateway',
  'Agentic commerce',
  'AI agent',
  'VISA',
  'MASTERCARD',
  'AMEX'
];

function get(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}${pathname}`, { headers: { 'cache-control': 'no-cache' } }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error(`timeout: ${pathname}`)));
  });
}

function fail(message) {
  console.error(`STOREfront_UX_GATE_FAILED: ${message}`);
  process.exitCode = 1;
}

async function main() {
  const home = await get('/');
  if (home.status !== 200) fail(`homepage status ${home.status}`);

  const html = home.body;
  const required = [
    ['DreamLedger', /DreamLedger/i],
    ['DreamMeez', /DreamMeez/i],
    ['shop heading', /Shop the collection\./i],
    ['avatar', /class="avatar"/i],
    ['catalog carousel', /id="rail"/i],
    ['MTG carousel', /id="mtgRail"/i],
    ['digital product', /Product Evidence Passport/i],
    ['listing audit', /Listing Evidence Audit/i],
    ['billboard feature', /Founding Tile\./i]
  ];

  for (const [label, pattern] of required) {
    if (!pattern.test(html)) fail(`missing ${label} on homepage`);
  }

  for (const token of FORBIDDEN_PUBLIC) {
    if (html.toLowerCase().includes(token.toLowerCase())) fail(`forbidden public copy: ${token}`);
  }

  const proof = {
    status: process.exitCode ? 'FAIL' : 'PASS',
    timestamp_utc: new Date().toISOString(),
    homepage_status: home.status,
    runtime_scope: 'homepage_only',
    homepage_required_markers: required.map(([label]) => label),
    forbidden_public_copy_checked: FORBIDDEN_PUBLIC,
    approved_checkout_ids: [...APPROVED_CHECKOUT_IDS],
    offers_json_valid: parsed !== null
  };
  console.log(JSON.stringify(proof, null, 2));
  if (process.exitCode) process.exit(1);
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
