#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', '..', 'data', '777', 'b2b-sales-hypotheses.v1.json');
const fail = (message) => { console.error('FAIL:', message); process.exitCode = 1; };
let data;
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (error) { fail('Registry is not readable valid JSON: ' + error.message); process.exit(); }

if (data.schema_version !== 'dreamledger.sales-hypothesis-swarm.v1') fail('Unexpected schema_version');
if (data.status !== 'INTERNAL_CANDIDATES_NOT_VALIDATED') fail('Candidates must remain explicitly unvalidated');
if (!Array.isArray(data.hypotheses) || data.hypotheses.length < 1) fail('No hypotheses found');

const ids = new Set();
const dedupe = new Set();
const required = ['id','name','buyer','job_to_be_done','price_hypothesis_nzd','fulfillment_contract','demand_evidence_required','silo_candidate','priority','status','next_test','kill_rule'];
for (const [index, item] of (data.hypotheses || []).entries()) {
  for (const key of required) if (!String(item[key] ?? '').trim()) fail('hypotheses[' + index + '] missing ' + key);
  if (ids.has(item.id)) fail('Duplicate hypothesis id: ' + item.id);
  ids.add(item.id);
  const key = [item.buyer, item.job_to_be_done, item.fulfillment_contract].join('|').toLowerCase();
  if (dedupe.has(key)) fail('Duplicate buyer/job/fulfillment tuple: ' + item.id);
  dedupe.add(key);
  if (item.status !== 'HYPOTHESIS_UNVALIDATED') fail(item.id + ' cannot be promoted by seed data');
  if (!['P1','P2','P3'].includes(item.priority)) fail(item.id + ' has invalid priority');
  if (/bypass|captcha|session impersonation|credential replay/i.test(item.fulfillment_contract)) fail(item.id + ' contains prohibited platform circumvention');
}
for (const [key, expected] of Object.entries({
  no_fabricated_demand: true,
  no_self_purchase: true,
  no_unlicensed_scraping_or_bot_protection_bypass: true,
  no_publication_without_gate: true,
  no_production_database_writes_until_supabase_health_is_confirmed: true,
  no_claim_of_verified_revenue_until_settlement_fulfillment_delivery_and_independent_evidence_reconcile: true
})) if (data.guardrails?.[key] !== expected) fail('Missing/false guardrail: ' + key);

if (!process.exitCode) {
  console.log(JSON.stringify({
    status: 'PASS_INTERNAL_HYPOTHESIS_REGISTRY_ONLY',
    hypotheses: data.hypotheses.length,
    unique_ids: ids.size,
    unique_buyer_job_fulfillment_tuples: dedupe.size,
    qualified_buyer_intents: 0,
    settled_payments: 0,
    verified_revenue_nzd: 0
  }, null, 2));
}
