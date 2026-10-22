'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const oracle = require('../runtime/TruthOracle');

test('Truth Oracle exposes the required evidence taxonomy', () => {
  assert.deepEqual(oracle.EVIDENCE_TYPES, [
    'OBSERVED','INDEPENDENTLY_VERIFIED','SOURCE_SUPPORT','DERIVED','INFERRED','CONTRADICTED','UNKNOWN'
  ]);
});

test('confidence calculation is deterministic and freshness bounded', () => {
  const now = Date.parse('2026-09-03T00:00:00Z');
  const evidence = [
    {type:'OBSERVED',timestamp:'2026-09-03T00:00:00Z'},
    {type:'INDEPENDENTLY_VERIFIED',timestamp:'2026-06-03T00:00:00Z'},
    {type:'SOURCE_SUPPORT',timestamp:'2025-09-03T00:00:00Z'},
    {type:'CONTRADICTED',timestamp:'2026-09-03T00:00:00Z'}
  ];
  const a = oracle.confidenceScore(evidence, 0, now);
  const b = oracle.confidenceScore(evidence, 0, now);
  assert.equal(a,b);
  assert.ok(a >= 0 && a <= 100);
});

test('unknown evidence and unresolved items reduce certainty without changing truth inputs', () => {
  const now = Date.parse('2026-09-03T00:00:00Z');
  const evidence = [{type:'UNKNOWN',timestamp:'2026-09-03T00:00:00Z'}];
  const noUnresolved = oracle.confidenceScore(evidence,0,now);
  const unresolved = oracle.confidenceScore(evidence,2,now);
  assert.ok(unresolved < noUnresolved);
});

test('confidence bands cover the full public range', () => {
  assert.equal(oracle.confidenceBand(0),'VERY LOW');
  assert.equal(oracle.confidenceBand(20),'VERY LOW');
  assert.equal(oracle.confidenceBand(21),'LOW');
  assert.equal(oracle.confidenceBand(40),'LOW');
  assert.equal(oracle.confidenceBand(41),'MODERATE');
  assert.equal(oracle.confidenceBand(60),'MODERATE');
  assert.equal(oracle.confidenceBand(61),'HIGH');
  assert.equal(oracle.confidenceBand(80),'HIGH');
  assert.equal(oracle.confidenceBand(81),'VERY HIGH');
  assert.equal(oracle.confidenceBand(100),'VERY HIGH');
});

test('NZ cost-of-living and supplier quote comparison are free umbrella capabilities', () => {
  const fs=require('node:fs'),path=require('node:path');
  const root=path.join(__dirname,'..');
  const policy=JSON.parse(fs.readFileSync(path.join(root,'catalog/truth-oracle/pricing.json'),'utf8'));
  assert.equal(policy.commercial_model.scope,'TRUTH_ORACLE_UMBRELLA');
  assert.equal(policy.commercial_model.standalone_capability_checkout,false);
  for (const id of ['NZ_COST_OF_LIVING','SUPPLIER_QUOTE_COMPARISON']) {
    const cap=policy.capabilities.find(x=>x.id===id);
    assert.ok(cap,id);
    assert.equal(cap.tier,'FREE');
    assert.equal(cap.price_nzd,0);
    assert.equal(cap.checkout_enabled,false);
  }
});

test('digital arbitrage is a held premium candidate, not an independent SKU', () => {
  const fs=require('node:fs'),path=require('node:path');
  const policy=JSON.parse(fs.readFileSync(path.join(__dirname,'../catalog/truth-oracle/pricing.json'),'utf8'));
  const cap=policy.capabilities.find(x=>x.id==='DIGITAL_ARBITRAGE_INTELLIGENCE');
  assert.equal(cap.tier,'PREMIUM_CANDIDATE');
  assert.equal(cap.public,false);
  assert.equal(cap.checkout_enabled,false);
  assert.equal(cap.fulfillment_state,'NOT_PROVEN');
  for(const plan of policy.plans.filter(p=>Number(p.price_nzd_month)>0)) {
    assert.equal(plan.checkout_enabled,false);
    assert.equal(plan.commercial_state,'HELD_PENDING_DEMAND_FULFILLMENT_AND_AUTHORITY');
  }
});

test('Oracle generated HTML discloses free routes and no unreleased purchase controls', () => {
  const page=oracle.html();
  assert.match(page,/\/cost-of-living\.html/);
  assert.match(page,/\/quote-comparison\//);
  assert.doesNotMatch(page,/<button[^>]+data-tier=/);
  assert.match(page,/not currently accepting payment/);
  assert.match(page,/Payment never changes the underlying verdict/);
});

test('public umbrella never promotes standalone document extraction or private engine labels', () => {
  const fs=require('node:fs'),path=require('node:path');
  const root=path.join(__dirname,'../..');
  const landing=fs.readFileSync(path.join(root,'public/truth-oracle.html'),'utf8');
  const household=fs.readFileSync(path.join(root,'public/cost-of-living.html'),'utf8');
  const worksheet=fs.readFileSync(path.join(root,'public/quote-comparison/index.html'),'utf8');
  assert.match(landing,/\/quote-comparison\//);
  assert.match(landing,/\/cost-of-living\.html/);
  assert.doesNotMatch(landing,/\/buy\/DOC-EXTRACT-50|Gauntlet \/ Elohim|From NZ\$5/);
  assert.match(household,/Supplier Quote Comparison/);
  assert.match(household,/\/truth-oracle\.html/);
  assert.match(worksheet,/Truth Oracle · Free New Zealand comparison utility/);
});
