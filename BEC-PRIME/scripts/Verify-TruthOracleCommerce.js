'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const pricingPath = path.join(ROOT, 'catalog', 'truth-oracle', 'pricing.json');
const siloPath = path.join(ROOT, 'silos', 'SILO_TRUTH_ORACLE', 'config.json');
const routePath = path.join(ROOT, 'routes', 'truthOracleCommerce.js');
const oraclePath = path.join(ROOT, 'runtime', 'TruthOracle.js');
const startPath = path.join(ROOT, 'start.js');
const pagePath = path.join(ROOT, 'compiled', 'website', 'truth-oracle.html');
const required = [pricingPath, siloPath, routePath, oraclePath, startPath, pagePath];
const failures = [];
for (const file of required) if (!fs.existsSync(file)) failures.push('missing:' + path.relative(ROOT,file));
if (!failures.length) {
  const pricing = JSON.parse(fs.readFileSync(pricingPath,'utf8'));
  const silo = JSON.parse(fs.readFileSync(siloPath,'utf8'));
  const route = fs.readFileSync(routePath,'utf8');
  const oracle = fs.readFileSync(oraclePath,'utf8');
  const start = fs.readFileSync(startPath,'utf8');
  const page = fs.readFileSync(pagePath,'utf8');
  const expected = [['SIGNAL','Observer',4.99],['INTELLIGENCE','Investigator',7.99],['DEEP_EVIDENCE','Deep Evidence',9.99]];
  for (const [tier,name,price] of expected) {
    const plan = pricing.plans.find(p => p.tier === tier);
    if (!plan || plan.display_name !== name || Number(plan.price_nzd_month) !== price || !plan.stripe_price_id) failures.push('plan:' + tier);
    const stripePlan = silo.tiers.find(p => p.tier === tier);
    if (!stripePlan || stripePlan.display_name !== name || Number(stripePlan.price_nzd_month) !== price || !stripePlan.price_id) failures.push('silo-plan:' + tier);
  }
  if (!pricing.plans.some(p => p.tier === 'FREE' && Number(p.price_nzd_month) === 0)) failures.push('free-tier');
  for (const type of ['OBSERVED','INDEPENDENTLY_VERIFIED','SOURCE_SUPPORT','DERIVED','INFERRED','CONTRADICTED','UNKNOWN']) if (!oracle.includes("'" + type + "'")) failures.push('evidence-type:' + type);
  if (!/Math\.max\(0\.5,\s*1\s*-\s*ageDays\([^)]*\)\s*\/\s*365\)/.test(oracle)) failures.push('confidence-rule:age-decay');
  if (!/unresolvedCount/.test(oracle) || !/\*\s*1\.5/.test(oracle)) failures.push('confidence-rule:unresolved-penalty');
  if (!/Math\.round/.test(oracle)) failures.push('confidence-rule:rounding');
  for (const rule of ['authentication_required','client_reference_id:user.id','metadata[user_id]','stripeProof.verifyStripeSignature','invoice.paid','customer.subscription.deleted']) if (!route.includes(rule)) failures.push('billing-boundary:' + rule);
  if (!start.includes("require('./routes/truthOracleCommerce')")) failures.push('truth-route-not-mounted');
  if (!start.includes('truthOracleCommerce.handleStripeWebhook')) failures.push('truth-webhook-not-mounted');
  for (const price of ['NZ$4.99','NZ$7.99','NZ$9.99']) if (!page.includes(price)) failures.push('public-price:' + price);
  if (!/Payment never changes the underlying verdict|payment.*underlying verdict/i.test(page)) failures.push('public-truth-rule');
  if (!/cannot pay to make reality look better|payment.*verdict.*confidence/i.test(page)) failures.push('commercial-rule');
  if (!route.includes("tier:'public'")) failures.push('public-default-entitlement');
  if (!route.includes("record.environment!=='live'")) failures.push('live-environment-boundary');
}
if (failures.length) { console.error('FAIL Truth Oracle commerce verification'); console.error(JSON.stringify(failures,null,2)); process.exit(1); }
console.log('PASS Truth Oracle commerce verification');
console.log('Economic Truth Oracle: present');
console.log('Pricing: NZ$4.99 / NZ$7.99 / NZ$9.99 monthly');
console.log('Free public layer: present');
console.log('Authenticated server entitlement: present');
console.log('Truth/payment separation: present');
