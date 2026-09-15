const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DISCOVERY = path.join(ROOT, 'compiled', 'website', '.well-known', 'agent-commerce.json');
const OFFERS = path.join(ROOT, 'catalog', 'offers', 'offers.json');
const APPROVED = path.join(ROOT, 'catalog', 'offers', 'approved.json');
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
  const approvedCatalog = readJson(APPROVED);
  const offers = Array.isArray(catalog.offers) ? catalog.offers : [];
  const approved = Array.isArray(approvedCatalog.approved) ? approvedCatalog.approved : [];
  const currentOffers = Array.isArray(discovery.current_offers) ? discovery.current_offers : [];

  check('DISCOVERY_SCHEMA', discovery.schema === 'dreamledger/agent-commerce-manifest/v1', `schema=${discovery.schema}`);
  check('DISCOVERY_NAME', discovery.name === 'DreamLedger', `name=${discovery.name}`);
  check('DISCOVERY_PRIVATE_MATERIAL', discovery.private_material === 'excluded', `private_material=${discovery.private_material}`);
  check('DISCOVERY_CURRENT_OFFERS_ARRAY', Array.isArray(discovery.current_offers), `current_offers_type=${typeof discovery.current_offers}`);
  check('DISCOVERY_CAPABILITIES_ARRAY_OR_NULL', discovery.capabilities === null || Array.isArray(discovery.capabilities), `capabilities_type=${discovery.capabilities === null ? 'null' : typeof discovery.capabilities}`);
  check('DISCOVERY_FIRST_PAYMENT', discovery.first_payment_proof === 'NOT_PROVEN' || typeof discovery.first_payment_proof === 'string', `first_payment_proof=${discovery.first_payment_proof}`);
  check('DISCOVERY_REVENUE_NONNEGATIVE', Number.isFinite(discovery.revenue_nzd) && discovery.revenue_nzd >= 0, `revenue_nzd=${discovery.revenue_nzd}`);
  check('DISCOVERY_APPROVALS_ARRAY', Array.isArray(discovery.approval_required_for), 'approval_required_for must be an array');
  check('CATALOG_SCHEMA', catalog.schema === 'BEC-PRIME/OFFER-CATALOG/v1', `schema=${catalog.schema}`);
  check('CATALOG_APPROVAL_RULE', typeof catalog.approval_rule === 'string' && catalog.approval_rule.length > 0, 'approval_rule missing');
  check('APPROVED_SCHEMA', approvedCatalog.schema === 'BEC-PRIME/APPROVED-OFFERS/v6', `schema=${approvedCatalog.schema}`);

  let unsafeCurrent = 0;
  for (const offer of currentOffers) {
    const unsafe = offer && offer.approval_required === false && offer.checkout_available === true && offer.status === 'VERIFIED_AVAILABLE';
    if (unsafe) unsafeCurrent += 1;
  }
  check('CURRENT_AGENT_OFFERS_SAFE', unsafeCurrent === 0, `unsafe_current_agent_offers=${unsafeCurrent}`);

  let unsafeGenerated = 0;
  for (const offer of offers) {
    const unsafe = offer && offer.approval_required === false && offer.checkout_available === true && offer.status === 'VERIFIED_AVAILABLE';
    if (unsafe) unsafeGenerated += 1;
  }
  check('GENERATED_OFFERS_SAFE', unsafeGenerated === 0, `unsafe_generated_offers=${unsafeGenerated}`);

  const approvedIds = new Set(approved.map((offer) => offer && offer.offer_id).filter(Boolean));
  const duplicateApprovedIds = approved.length - approvedIds.size;
  check('APPROVED_IDS_UNIQUE', duplicateApprovedIds === 0, `duplicate_approved_ids=${duplicateApprovedIds}`);

  const result = {
    type: 'dreamledger-agentic-commerce-gauntlet',
    version: 2,
    timestamp: new Date().toISOString(),
    status: process.exitCode ? 'FAIL' : 'PASS',
    source_of_truth: '/api/offers',
    payment_authority: 'existing-stripe-webhook-and-settlement-ledger',
    agent_authentication: 'not-user-agent-based',
    counts: {
      generated_offers: offers.length,
      approved_offers: approved.length,
      current_agent_offers: currentOffers.length
    },
    checks
  };
  fs.writeFileSync(PROOF, JSON.stringify(result, null, 2) + '\n');
  console.log(`AGENTIC_COMMERCE_${result.status}`);
  if (process.exitCode) process.exit(1);
} catch (err) {
  const result = {
    type: 'dreamledger-agentic-commerce-gauntlet',
    version: 2,
    timestamp: new Date().toISOString(),
    status: 'FAIL',
    error: err.message,
    checks
  };
  fs.writeFileSync(PROOF, JSON.stringify(result, null, 2) + '\n');
  console.error(`AGENTIC_COMMERCE_FAIL ${err.message}`);
  process.exit(1);
}
