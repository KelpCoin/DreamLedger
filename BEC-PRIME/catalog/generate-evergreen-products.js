'use strict';

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'evergreen-products.json');

const domains = [
  ['MTG', 'Commander'], ['MTG', 'Collection'], ['MTG', 'Selling'], ['MTG', 'Buying'],
  ['Commerce', 'Commerce'], ['Commerce', 'Agentic'], ['Commerce', 'Trust'], ['Commerce', 'Operations'],
  ['Creator', 'Content'], ['Creator', 'Research']
];

const formats = [
  ['Diagnostic', 15, 'A bounded diagnostic that converts messy input into ranked actions.', 'manual audits and generic AI chat', 'fixed scope and reusable diagnostic pipeline'],
  ['Blueprint', 79, 'An implementation-ready blueprint with decisions, dependencies and acceptance tests.', 'consulting engagements and agency discovery', 'productized scope replaces open-ended consulting'],
  ['Optimizer', 49, 'A constrained optimization report for improving cost, speed or consistency.', 'freelance optimization work and calculators', 'one narrow decision instead of ongoing service'],
  ['Audit', 49, 'An evidence-backed audit with a prioritized remediation list.', 'consulting audits and agency audits', 'automated evidence collection and bounded scope'],
  ['Kit', 29, 'A reusable toolkit of templates, checklists and scripts.', 'template marketplaces and starter packs', 'digital delivery with no inventory or shipping'],
  ['Monitor', 39, 'A defined monitoring pack with repeatable checks and escalation rules.', 'monitoring SaaS and manual review', 'narrow monitoring surface and low compute'],
  ['Generator', 29, 'A guided generator that produces one finished business artifact.', 'AI workspaces and freelancers', 'specific outcome rather than a general-purpose workspace'],
  ['Playbook', 29, 'A concise operating playbook for one recurring task.', 'courses, books and consultants', 'short operational artifact rather than a course'],
  ['Scorecard', 15, 'A scored assessment with evidence and next actions.', 'online assessments and consultant scorecards', 'instant structured scoring and fixed scope'],
  ['Research Pack', 39, 'A compact research dossier answering one commercial question.', 'market research firms and broad web search', 'narrow question and reusable research pipeline']
];

function makeProduct(index, domain, format) {
  const [category, subject] = domain;
  const [type, price, why, competitor, cheaper] = format;
  const slug = `${category}-${subject}-${type}`.toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  return {
    product_id: `ELM-${String(index).padStart(3, '0')}-${slug}`,
    title: `${subject} ${type}`,
    category,
    why_exists: why,
    buyer: `${subject} operators, creators, sellers or teams who need a bounded outcome`,
    competitor,
    cheaper_because: cheaper,
    fulfilment: 'evergreen digital delivery; generated or precompiled artifact',
    entitlement: { mode: 'permanent', duration_days: null },
    price_nzd: price,
    status: 'candidate',
    silo: category === 'MTG' ? 'SILO_MTG' : 'SILO_COMMERCE',
    gauntlet: 'required',
    elohim_role: 'review, contradiction detection, evidence gating and escalation only',
    asymmetric_leverage: 'one compiled artifact can serve many customers without proportional delivery labour',
    gauntlet_net: 'must pass evidence, pricing, silo, entitlement and fulfilment checks before activation'
  };
}

const products = [];
let index = 1;
for (const domain of domains) for (const format of formats) products.push(makeProduct(index++, domain, format));

const catalog = {
  schema: 'BEC-PRIME/EVERGREEN-PRODUCT-CATALOG/v1',
  count: products.length,
  activation_policy: 'candidate products are not purchasable until explicitly approved',
  entitlement_policy: 'content remains locked until a verified payment transaction grants an entitlement',
  products
};

fs.writeFileSync(OUT, JSON.stringify(catalog, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', output: OUT, count: products.length }, null, 2));
