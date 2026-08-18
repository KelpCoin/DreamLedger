const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DISCOVERY = path.join(ROOT, 'compiled', 'website', '.well-known', 'agent-commerce.json');
const OFFERS = path.join(ROOT, 'catalog', 'offers', 'offers.json');
const PROOF = path.join(ROOT, 'PROOF-AGENTIC-COMMERCE.json');

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${path.relative(ROOT, file)}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fail(message) {
  console.error(`AGENTIC_COMMERCE_FAIL ${message}`);
  process.exitCode = 1;
}

const checks = [];
function check(name, condition, detail) {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL', detail });
  if (!condition) fail(`${name}: ${detail}`);
}

try {
  const discovery = readJson(DISCOVERY);
  const catalog = readJson(OFFERS);
  const offers = Array.isArray(catalog.offers) ? catalog.offers : [];

  check('DISCOVERY_SCHEMA', discovery.schema === 'dreamledger/agent-commerce/v1', `schema=${discovery.schema}`);
  check('DISCOVERY_SERVICE', discovery.service === 'DreamLedger', `service=${discovery.service}`);
  check('DISCOVERY_CURRENCY', discovery.currency === 'NZD', `currency=${discovery.currency}`);
  check('DISCOVERY_SOURCE', discovery.source_of_truth === '/api/offers', `source=${discovery.source_of_truth}`);
  check('DISCOVERY_APPROVAL', discovery.approval_model === 'explicit_human_approval', `approval_model=${discovery.approval_model}`);
  check('DISCOVERY_CHECKOUT_DEFAULT', discovery.offers_are_checkout_disabled_by_default === true, `checkout_default=${discovery.offers_are_checkout_disabled_by_default}`);
  check('DISCOVERY_PRIVATE_IP', discovery.private_material === 'excluded', `private_material=${discovery.private_material}`);
  check('DISCOVERY_CHECKOUT_ROUTE', discovery.checkout === '/api/offer-checkout/create', `checkout=${discovery.checkout}`);

  let approved = 0;
  for (const offer of offers) {
    const safe = offer.approval_required === true || offer.checkout_available !== true || offer.status !== 'VERIFIED_AVAILABLE';
    check(`OFFER_POLICY_${offer.offer_id || 'UNKNOWN'}`, safe, 'No unapproved offer may become agent-checkout available');
    if (offer.approval_required === false && offer.checkout_available === true && offer.status === 'VERIFIED_AVAILABLE') approved += 1;
  }

  check('AGENT_CHECKOUT_NOT_OPEN_BY_DEFAULT', approved === 0, `verified_available_offers=${approved}`);

  const result = {
    type: 'dreamledger-agentic-commerce-gauntlet',
    version: 1,
    timestamp: new Date().toISOString(),
    status: process.exitCode ? 'FAIL' : 'PASS',
    source_of_truth: discovery.source_of_truth,
    payment_authority: 'existing-stripe-webhook-and-settlement-ledger',
    agent_authentication: 'not-user-agent-based',
    checks
  };
  fs.writeFileSync(PROOF, JSON.stringify(result, null, 2) + '\n');
  console.log(`AGENTIC_COMMERCE_${result.status}`);
  if (process.exitCode) process.exit(1);
} catch (err) {
  const result = {
    type: 'dreamledger-agentic-commerce-gauntlet',
    version: 1,
    timestamp: new Date().toISOString(),
    status: 'FAIL',
    error: err.message,
    checks
  };
  fs.writeFileSync(PROOF, JSON.stringify(result, null, 2) + '\n');
  console.error(`AGENTIC_COMMERCE_FAIL ${err.message}`);
  process.exit(1);
}
