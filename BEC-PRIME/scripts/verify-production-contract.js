'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const errors = [];

const required = [
  'compiled/website/index.html',
  'compiled/website/mtg/index.html',
  'compiled/website/truth-oracle.html',
  'compiled/website/truth-oracle.json',
  'compiled/website/transparency-policy.json',
  'catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json'
];

for (const rel of required) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
    errors.push(`MISSING:${rel}`);
  }
}

function readJson(rel) {
  const file = path.join(root, rel);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    errors.push(`INVALID_JSON:${rel}`);
    return {};
  }
}

const product = readJson('catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json');
const diagnostic = readJson('catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json');

if (
  diagnostic.id !== 'COMMANDER-DECK-DIAGNOSTIC-001' ||
  diagnostic.status !== 'held' ||
  diagnostic.inventory !== 0 ||
  diagnostic.checkout?.mode !== 'disabled' ||
  diagnostic.commercial_truth?.approval_required !== true ||
  diagnostic.commercial_truth?.sellable !== false
) {
  errors.push('HELD_DIAGNOSTIC_BOUNDARY_BREACH');
}

const homepageFile = path.join(root, 'compiled/website/index.html');

if (fs.existsSync(homepageFile)) {
  const homepage = fs.readFileSync(homepageFile, 'utf8');

  for (const forbidden of [
    'cinema-event-v1',
    '/cinema.html',
    'Amplissa',
    'HappyHomarid',
    'CollectorsCoast',
    'adult-only',
    'adult only',
    'stripe_secret_key',
    'stripe_webhook_secret',
    '/var/data/'
  ]) {
    if (homepage.includes(forbidden)) {
      errors.push(`PUBLIC_BOUNDARY_LEAK:${forbidden}`);
    }
  }
}

const result = {
  schema: 'BEC-PRIME/PRODUCTION-CONTRACT/v3',
  status: errors.length ? 'FAIL' : 'PASS',
  checked_at: new Date().toISOString(),
  commercial_priority: {
    commander_diagnostic: 'HELD_NOT_A_REVENUE_PLAN',
    checkout: 'DISABLED',
    inventory: 0,
    next_gate: 'INDEPENDENT_BUYER_SETTLEMENT_AND_VERIFIED_DELIVERY'
  },
  excluded_surfaces: ['cinema', 'private-adult-boundary'],
  errors
};

fs.writeFileSync(
  path.join(root, 'PROOF-PRODUCTION-CONTRACT.json'),
  JSON.stringify(result, null, 2) + '\n',
  'utf8'
);

console.log(JSON.stringify(result, null, 2));
process.exit(errors.length ? 1 : 0);