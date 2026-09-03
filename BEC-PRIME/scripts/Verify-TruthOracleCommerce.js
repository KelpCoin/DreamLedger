'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const pricingPath = path.join(ROOT, 'catalog', 'truth-oracle', 'pricing.json');
const siloPath = path.join(ROOT, 'silos', 'SILO_TRUTH_ORACLE', 'config.json');
const routePath = path.join(ROOT, 'routes', 'truthOracleCommerce.js');
const pagePath = path.join(ROOT, 'compiled', 'website', 'truth-oracle.html');
const required = [pricingPath, siloPath, routePath, pagePath];
const failures = [];
for (const file of required) if (!fs.existsSync(file)) failures.push('missing:' + path.relative(ROOT,file));
if (!failures.length) {
  const pricing = JSON.parse(fs.readFileSync(pricingPath,'utf8'));
  const silo = JSON.parse(fs.readFileSync(siloPath,'utf8'));
  const route = fs.readFileSync(routePath,'utf8');
  const page = fs.readFileSync(pagePath,'utf8');
  const expected = [['SIGNAL',4.99],['INTELLIGENCE',7.99],['DEEP_EVIDENCE',9.99]];
  for (const [tier,price] of expected) {
    const plan = pricing.plans.find(p => p.tier === tier);
    if (!plan || Number(plan.price_nzd_month) !== price || !plan.stripe_price_id) failures.push('plan:' + tier);
    const stripePlan = silo.tiers.find(p => p.tier === tier);
    if (!stripePlan || Number(stripePlan.price_nzd_month) !== price || !stripePlan.price_id) failures.push('silo-plan:' + tier);
  }
  if (!pricing.plans.some(p => p.tier === 'FREE' && Number(p.price_nzd_month) === 0)) failures.push('free-tier');
  if (!route.includes("mode:'subscription'")) failures.push('subscription-mode');
  if (!route.includes("metadata[truth_oracle_tier]")) failures.push('tier-metadata');
  if (!route.includes("truth_unchanged:true")) failures.push('truth-unchanged-contract');
  if (!page.includes('NZ$4.99 / month') || !page.includes('NZ$7.99 / month') || !page.includes('NZ$9.99 / month')) failures.push('public-pricing');
  if (!page.includes('Payment never changes the underlying verdict')) failures.push('public-truth-rule');
}
if (failures.length) { console.error('FAIL Truth Oracle commerce verification'); console.error(JSON.stringify(failures,null,2)); process.exit(1); }
console.log('PASS Truth Oracle commerce verification');
console.log('Pricing: NZ$4.99 / NZ$7.99 / NZ$9.99 monthly');
console.log('Free public layer: present');
console.log('Truth/payment separation: present');
