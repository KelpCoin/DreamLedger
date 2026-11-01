'use strict';

// Offline regression for BECK's portfolio-wide candidate selector.
// No provider calls and no revenue claims.
const assert = require('node:assert/strict');
const { score, verdict, normalizeSilo } = require('./EconomicOpportunityCompiler');

let cases = 0;
function test(name, fn) { fn(); cases++; process.stdout.write('PASS ' + name + '\n'); }
const sample = {
  silo: 'B2B', evidence_score: 10, evidence_required: ['claimed paid buyer'],
  test_cost_nzd: 0, upside_nzd: 1000000000, speed_score: 10, risk_score: 0
};

test('No artificial ROI from NZ$0 cost', () => {
  const x = score(sample);
  assert.equal(x.roi, 0);
  assert.equal(x.zero_cost_is_unverified, true);
});
test('Self-reported evidence never means paid buyer', () => {
  const x = score(sample);
  assert.equal(x.evidence, 4);
  assert.equal(x.verified_external_buyer, false);
  assert.equal(x.verified_settlement, false);
  assert.equal(x.verified_fulfillment, false);
  assert.equal(x.evidence_ready, false);
  assert.equal(verdict(x), 'NEEDS_EXTERNAL_VERIFICATION');
});
test('Zero cost cannot beat a verified economic event', () => {
  assert.equal(score(sample).release_authorized, false);
});
test('MTG gets no exclusive advantage over B2B', () => {
  const a = score({...sample, silo:'MTG'});
  const b = score({...sample, silo:'B2B'});
  assert.equal(a.total,b.total);
  assert.equal(a.silo_alignment,0);
  assert.equal(b.silo_alignment,0);
});
test('All legitimate portfolio lanes remain eligible for independent verification', () => {
  for(const silo of ['MTG','B2B','BILLBOARD','DREAMMEEZ','KELPHAVEN',
                     'PHINHAVEN','TRUTH_ORACLE','DIGITAL_PRODUCTS','GAME']) {
    assert.equal(verdict(score({...sample,silo})), 'NEEDS_EXTERNAL_VERIFICATION', silo);
  }
});
test('Amplissa quarantine persists under case and spelling variants', () => {
  for(const silo of ['Amplissa','adult','silo-adult','SILO_ADULT']) {
    assert.equal(verdict(score({...sample,silo})), 'QUARANTINE', silo);
  }
});
test('Unknown silo not promoted', () => {
  assert.equal(verdict(score({...sample, silo:' '})), 'QUARANTINE');
  assert.equal(normalizeSilo([]),'UNKNOWN');
});
test('High risk is quarantined', () => {
  assert.equal(verdict(score({...sample,risk_score:9})), 'QUARANTINE');
});
test('Missing, null and negative costs never earn an ROI bonus', () => {
  for(const c of [null,undefined,-1,NaN,'']) {
    assert.equal(score({...sample,test_cost_nzd:c}).roi,0);
  }
});
test('Cost estimate remains hypothetical even if nonzero', () => {
  const x = score({...sample,test_cost_nzd:10,upside_nzd:100});
  assert.equal(x.roi,1);
  assert.equal(x.evidence_ready,false);
  assert.equal(verdict(x),'NEEDS_EXTERNAL_VERIFICATION');
});
test('Malformed and missing inputs fail closed', () => {
  assert.equal(verdict(score(null)),'QUARANTINE');
  assert.equal(verdict(score([])),'QUARANTINE');
  assert.equal(verdict(score({})),'QUARANTINE');
});

process.stdout.write('PASS ' + cases + ' policy regression groups\n');
