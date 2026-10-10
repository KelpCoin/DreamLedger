'use strict';
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '../..');
const manifestPath = path.join(repo, 'ops/revenue/revenue-engines.v1.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const checks = [];
function check(name, ok, detail = '') { checks.push({ name, ok: Boolean(ok), detail }); }
function exists(rel) { return fs.existsSync(path.join(repo, rel)); }
function includes(rel, needle) {
  try { return fs.readFileSync(path.join(repo, rel), 'utf8').includes(needle); }
  catch { return false; }
}

check('MANIFEST_SCHEMA', manifest.schema === 'dreamledger.revenue-engines.v1');
check('ZERO_UPFRONT_SPEND', manifest.constraints.incremental_spend_nzd === 0);
check('TRUTH_BOUNDARY_COMPLETE', manifest.constraints.truth_boundary.length >= 6);
check('SERVICE_OFFER_CHECKOUT', manifest.engines.A_productized_b2b_services.primary_offer.checkout.startsWith('https://buy.stripe.com/'));
check('SERVICE_SCOPE_PRESENT', manifest.engines.A_productized_b2b_services.repeatable_fulfillment_artifacts.includes('delivery_receipt'));
check('PATREON_DISCORD_NOT_FALSE_GREEN', manifest.engines.B_recurring_monitoring.status === 'DESIGN_READY_EXTERNAL_ACCOUNT_LINK_REQUIRED');
check('MEMBERSHIP_RECONCILIATION', manifest.engines.B_recurring_monitoring.entitlement_rules.periodic_reconciliation_required === true);
check('A2A_SCHEMA_EXISTS', exists('data/schema/a2a-marketplace-v1.json'));
check('A2A_AGENT_CARD_EXISTS', exists('public/marketplace/agent-card.json'));
check('A2A_PUBLIC_SURFACE_EXISTS', exists('public/a2a-marketplace.html'));
check('M2M_ROUTE_SOURCE_EXISTS', exists('BEC-PRIME/routes/m2m.js'));
for (const route of [
  '/m2m/v1/marketplace/manifest',
  '/m2m/v1/marketplace/capabilities',
  '/m2m/v1/marketplace/search',
  '/m2m/v1/marketplace/quote',
  '/m2m/v1/marketplace/authorize',
  '/m2m/v1/marketplace/orders'
]) check('M2M_ROUTE_' + route.split('/').pop().toUpperCase(), includes('BEC-PRIME/routes/m2m.js', route), route);
check('B2B_TRANSACTION_CONTRACT', exists('docs/B2B-MARKETPLACE-TRANSACTION-OS.md'));
check('FULFILLMENT_EVIDENCE_CONTRACT', exists('docs/FORENSIC-FULFILLMENT-ACCEPTANCE.md'));
check('ZERO_REVENUE_BASELINE', manifest.scoreboard.verified_external_revenue_nzd === 0 && manifest.scoreboard.independent_external_buyers === 0);
check('NO_AUTOPUBLISH_CLAIM', manifest.distribution.status === 'PREPARE_ONLY_UNTIL_PUBLISHER_IS_CONNECTED');

const failed = checks.filter(x => !x.ok);
const result = {
  schema: 'dreamledger/revenue-engines-proof.v1',
  verdict: failed.length ? 'FAIL' : 'PASS',
  checks,
  failed: failed.map(x => x.name),
  external_integrations: {
    patreon: 'NOT_VERIFIED',
    discord: 'NOT_VERIFIED',
    social_publishing: 'NOT_VERIFIED'
  },
  economic_truth: 'This proof checks repository contracts only. It does not prove deployment, live account integration, buyers, settled payments, fulfillment, or revenue.'
};
const out = path.join(repo, 'BEC-PRIME/data/proofs/REVENUE-ENGINES-CONTRACT-PROOF.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exit(1);
