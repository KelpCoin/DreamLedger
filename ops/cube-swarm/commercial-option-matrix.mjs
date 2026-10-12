#!/usr/bin/env node
'use strict';

/**
 * Deterministic 50 x 10 commercial option matrix.
 * Every row is a hypothesis, never a sale candidate. No network, contact,
 * publishing, payment, or database side effects.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const flag = args.indexOf('--out');
const out = path.resolve(process.cwd(), flag >= 0 && args[flag + 1] ? args[flag + 1] : '.runtime/cube-swarm/commercial-option-matrix-latest.json');
const domains = [
['AI-agent output validation','AI product teams','malformed, unsupported, or unsafe agent outputs'],
['JSON schema compliance','API and integration teams','JSON payloads that fail downstream contracts'],
['Webhook reliability','SaaS operators','webhook retries, duplicates, and delivery gaps'],
['Payment reconciliation','online merchants','settlement records that do not match orders'],
['CSV data cleaning','operations teams','messy customer or supplier CSV files'],
['Spreadsheet reconciliation','finance and operations teams','disagreeing spreadsheets and unexplained variances'],
['Document field extraction','document-heavy businesses','key fields trapped in PDFs and forms'],
['Document contradiction detection','risk and operations teams','conflicting dates, amounts, names, or obligations'],
['Evidence completeness','AI vendors and software teams','missing proof for claims, tests, and delivery outcomes'],
['Supplier quote comparison','procurement teams','incomparable supplier proposals and hidden differences'],
['Product catalogue normalization','retailers and marketplaces','inconsistent product names, attributes, and formats'],
['SKU mismatch detection','retail and inventory teams','different identifiers referring to the same or conflicting products'],
['Duplicate record detection','CRM and data teams','duplicate customer, supplier, or product records'],
['Import preflight validation','platform and ecommerce teams','failed imports caused by bad data before upload'],
['API contract testing','software teams','breaking API changes and undocumented response shapes'],
['API response normalization','integration builders','different provider responses that need one stable format'],
['Log-based incident triage','small engineering teams','noisy logs that obscure likely causes and next steps'],
['Regression test generation','software maintainers','repeat bugs and missing coverage for changed behaviour'],
['Prompt output evaluation','AI product teams','unmeasured model output quality and format drift'],
['Data provenance manifests','data and AI teams','unclear origins, transformations, and lineage of datasets'],
['Version change analysis','software and data teams','meaningful changes hidden in version-to-version diffs'],
['Catalogue attribute completeness','catalogue managers','missing product attributes that block search or listing quality'],
['Public product feed conversion','retailers and feed operators','product feeds that need transformation for multiple destinations'],
['Inventory reconciliation','retail and warehouse teams','stock counts that diverge across systems'],
['Order-to-delivery linkage','online sellers','no reliable link from paid order to completed delivery'],
['Unfulfilled paid-order detection','commerce operators','settled orders without proof of fulfillment'],
['Refund and dispute evidence','merchants','scattered records needed to explain a refund or dispute'],
['Customer support case summarization','support teams','long case histories that need accurate concise handoffs'],
['Meeting and decision record extraction','distributed teams','decisions, owners, and due dates buried in notes'],
['Contract obligation tracking','service providers','contractual commitments that are easy to miss'],
['Policy-to-process gap analysis','operations and compliance teams','written policies that do not map to operational controls'],
['Compliance evidence packaging','regulated suppliers','evidence spread across folders and systems'],
['Security questionnaire response prep','B2B software vendors','repeated security questions and inconsistent supporting evidence'],
['Vendor due diligence comparison','buyers and procurement teams','vendor claims that are difficult to compare fairly'],
['Website content consistency','SaaS and ecommerce operators','conflicting product, price, or policy statements across pages'],
['Broken link and CTA audit','website owners','dead links or calls to action that silently lose conversions'],
['Landing-page message testing','small software businesses','unclear offer messaging and weak conversion evidence'],
['Inbound lead qualification','B2B operators','incoming enquiries that need structured triage without spam'],
['Sales inquiry pattern analysis','small B2B teams','repeated buyer questions that could reveal demand or objections'],
['Customer feedback clustering','product teams','feedback spread across reviews, tickets, and forms'],
['Pricing and packaging audit','software and service businesses','confusing tiers, inconsistent limits, and unclear value boundaries'],
['Service delivery checklist automation','small service firms','missed steps and inconsistent fulfillment'],
['File archive inventory','operations and research teams','unknown file contents, duplicates, and stale assets'],
['Media asset metadata cleanup','content and catalogue teams','missing or inconsistent media metadata'],
['Research source-to-claim mapping','analysts and AI teams','claims that lack traceable source evidence'],
['Decision memo evidence review','executives and project owners','decisions that rely on weak or contradictory evidence'],
['Machine-readable audit trail','AI and automation vendors','actions without a durable, inspectable evidence trail'],
['B2B catalogue onboarding','marketplaces and distributors','supplier catalogues that need repeatable onboarding'],
['Agent handoff validation','multi-agent system builders','tasks handed between agents without complete context or proof'],
['Scheduled data quality monitoring','data platform operators','silent data drift and recurring quality defects']
];
const models = [
['fixed-scope diagnostic','a bounded report identifying high-impact defects and their evidence'],
['done-for-you correction','a cleaned, reconciled, or repaired output with a change log'],
['implementation package','setup of a repeatable validator or workflow against one acceptance test'],
['recurring monitoring','scheduled checks, exception summaries, and evidence-backed alerts'],
['self-serve utility','a small upload-and-report tool with strict input and output limits'],
['metered API','usage-based access to one deterministic transformation or validation endpoint'],
['integration connector','a narrowly scoped connector between two named systems'],
['template and test pack','reusable schemas, fixtures, checklists, and regression tests with provenance'],
['managed workflow','an end-to-end bounded process with defined inputs, outputs, and recovery'],
['white-label or OEM license','a license for a provider that already serves the target buyer']
];
if (domains.length !== 50 || models.length !== 10) throw new Error('Matrix contract requires exactly 50 problem domains and 10 offer models.');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const rows = [];
for (const [domainIndex, d] of domains.entries()) {
  for (const [modelIndex, m] of models.entries()) {
    const id = 'DL-OPT-' + String(rows.length + 1).padStart(3, '0');
    const canonical = [d[0], m[0]].join('|').toLowerCase();
    rows.push({
      option_id: id,
      domain_id: 'DL-DOM-' + String(domainIndex + 1).padStart(2, '0'),
      model_id: 'DL-MOD-' + String(modelIndex + 1).padStart(2, '0'),
      title: d[0] + ' × ' + m[0],
      buyer_segment: d[1],
      problem: d[2],
      offer_model: m[0],
      proposed_deliverable: m[1],
      dedupe_key: sha(canonical),
      status: 'HYPOTHESIS_UNVALIDATED',
      evidence_status: 'UNVERIFIED',
      sale_candidate: false,
      external_actions_allowed: false,
      required_gates: ['SOURCE_GROUNDED_BUYER_INTENT','DEFINED_INPUT_OUTPUT','OWNERSHIP_AND_LICENSE_REVIEW','REPRODUCIBLE_TEST','AUTHORIZED_CHECKOUT','SETTLED_PAYMENT','FULFILLMENT_EVIDENCE','DELIVERY_RECEIPT','CONTRIBUTION_MARGIN'],
      promotion_rule: 'Do not promote without source-grounded demand and a verified buyer-to-settlement-to-delivery evidence chain.'
    });
  }
}
const payload = {
  schema: 'DREAMLEDGER-COMMERCIAL-OPTION-MATRIX/v1',
  generated_at_utc: new Date().toISOString(),
  generator: 'deterministic_50_domains_x_10_offer_models',
  count: rows.length,
  domain_count: domains.length,
  offer_model_count: models.length,
  truth_boundary: '500 structured hypotheses only. No demand, sale, revenue, or approval is implied.',
  no_external_actions: true,
  verified_revenue_nzd: 0,
  independent_buyers: 0,
  settled_external_payments: 0,
  fulfilled_paid_orders: 0,
  options: rows
};
if (payload.count !== 500 || rows.some(x => x.sale_candidate !== false || x.external_actions_allowed !== false || x.status !== 'HYPOTHESIS_UNVALIDATED')) {
  throw new Error('Commercial option matrix failed truth-boundary validation.');
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log('COMMERCIAL_OPTION_MATRIX_COUNT=' + rows.length);
console.log('COMMERCIAL_OPTION_MATRIX_STATUS=HYPOTHESIS_ONLY');
console.log('COMMERCIAL_OPTION_MATRIX_PATH=' + out);
