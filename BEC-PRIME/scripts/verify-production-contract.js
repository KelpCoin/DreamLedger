'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');
const errors = [];
const required = [
  'compiled/website/index.html',
  'compiled/website/truth-oracle.html',
  'compiled/website/truth-oracle.json',
  'compiled/website/transparency-policy.json'
];
for (const rel of required) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) errors.push('MISSING:' + rel);
}
const publicFiles = [
  'public/index.html',
  'public/b2b.html',
  'public/quote-comparison/index.html',
  'public/catalog.json'
];
for (const rel of publicFiles) {
  const file = path.join(repo, rel);
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) errors.push('MISSING:' + rel);
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { errors.push('INVALID_JSON:' + path.relative(repo, file)); return {}; }
}
const catalog = readJson(path.join(repo, 'public/catalog.json'));
if (catalog.schema !== 'dreamledger/public-catalogue/v1' || !Array.isArray(catalog.products)) {
  errors.push('PUBLIC_CATALOG_SCHEMA_INVALID');
}
const diagnostic = (catalog.products || []).find(p => p && p.id === 'COMMANDER-DECK-DIAGNOSTIC-001');
if (!diagnostic || diagnostic.status !== 'held' || diagnostic.checkout_available !== false) {
  errors.push('LEGACY_DIAGNOSTIC_MUST_REMAIN_HELD');
}
const homePath = path.join(repo, 'public/index.html');
const b2bPath = path.join(repo, 'public/b2b.html');
const quotePath = path.join(repo, 'public/quote-comparison/index.html');
const home = fs.existsSync(homePath) ? fs.readFileSync(homePath, 'utf8') : '';
const b2b = fs.existsSync(b2bPath) ? fs.readFileSync(b2bPath, 'utf8') : '';
const quote = fs.existsSync(quotePath) ? fs.readFileSync(quotePath, 'utf8') : '';
for (const [name, html] of [['homepage', home], ['b2b', b2b], ['quote-comparison', quote]]) {
  if (/AMPLISSA|COLLECTORSCOAST|SUPABASE_SERVICE_ROLE_KEY|stripe_secret_key|stripe_webhook_secret/i.test(html)) {
    errors.push('PUBLIC_BOUNDARY_LEAK:' + name);
  }
}
if (!/B2B marketplace/i.test(home) || !/href="\/b2b\//i.test(home)) errors.push('B2B_HOME_ROUTE_MISSING');
if (!/id="rfqForm"/i.test(b2b) || !/contact_consent/i.test(b2b)) errors.push('B2B_RFQ_CONSENT_CONTRACT_MISSING');
if (!/quote comparison|supplier quote/i.test(quote)) errors.push('QUOTE_COMPARISON_ROUTE_MISSING');
if (!/checkout is not enabled/i.test(b2b)) errors.push('B2B_CHECKOUT_STATE_MUST_BE_EXPLICIT');

const result = {
  schema: 'DREAMLEDGER/B2B-PRODUCTION-CONTRACT/v1',
  status: errors.length ? 'FAIL' : 'PASS',
  checked_at: new Date().toISOString(),
  primary_surface: 'B2B procurement and RFQ marketplace',
  free_surface: ['public supplier discovery when verified listings exist', 'browser-local quote comparison', 'RFQ submission with explicit contact consent'],
  payment_state: 'CHECKOUT_NOT_ENABLED',
  legacy_commander_diagnostic: 'HELD',
  errors
};
fs.writeFileSync(path.join(root, 'PROOF-PRODUCTION-CONTRACT.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(result, null, 2));
process.exit(errors.length ? 1 : 0);
