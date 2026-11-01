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

test('Unknown and malformed monetary declarations stay unknown', () => {
  const { money } = require('./EconomicOpportunityCompiler');
  for (const value of [undefined, null, '', ' ', false, true, [], [1], {}, -1, '-1', NaN, Infinity, 'Infinity', '0x10', '1e9']) {
    assert.equal(money(value), null, String(value));
    const s = score({...sample, test_cost_nzd: value});
    assert.equal(s.cost_known, false);
    assert.equal(s.zero_cost_is_unverified, false);
    assert.equal(s.roi, 0);
  }
});
test('Explicit zero and positive decimal declarations survive without verification', () => {
  const { money } = require('./EconomicOpportunityCompiler');
  for (const [input, expected] of [[0,0], ['0',0], [12.5,12.5], [' 12.50 ',12.5]]) {
    assert.equal(money(input),expected);
    assert.equal(score({...sample,test_cost_nzd:input}).verified_settlement,false);
  }
});
test('CLI preserves unknowns in JSON and Markdown, integrity and release gates', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { spawnSync } = require('node:child_process');
  const crypto = require('node:crypto');
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'beck-money-'));
  try {
    fs.mkdirSync(path.join(root,'compiler'));
    fs.mkdirSync(path.join(root,'opportunities'));
    const script = path.join(root,'compiler','EconomicOpportunityCompiler.js');
    fs.copyFileSync(require.resolve('./EconomicOpportunityCompiler'),script);
    const fixtures = [
      {opportunity_id:'unknown',silo:'B2B',title:'Unknown amounts'},
      {opportunity_id:'malformed',silo:'B2B',title:'Malformed amounts',price_nzd:false,test_cost_nzd:[],upside_nzd:' '},
      {opportunity_id:'zero',silo:'MTG',title:'Declared zero',price_nzd:29,test_cost_nzd:0,upside_nzd:100},
      {opportunity_id:'blocked',silo:'ADULT',title:'Quarantined',test_cost_nzd:0}
    ];
    fixtures.forEach((f,i)=>fs.writeFileSync(path.join(root,'opportunities',i+'.json'),JSON.stringify(f)));
    const run = spawnSync(process.execPath,[script],{encoding:'utf8',timeout:10000});
    assert.equal(run.status,0,run.stderr);
    const out = path.join(root,'compiled','opportunities');
    const report = JSON.parse(fs.readFileSync(path.join(out,'ECONOMIC_GAUNTLET.json'),'utf8'));
    const md = fs.readFileSync(path.join(out,'ECONOMIC_GAUNTLET.md'),'utf8');
    assert.equal(report.schema_version,'1.1');
    for (const id of ['unknown','malformed']) {
      const r=report.results.find(x=>x.opportunity_id===id);
      for (const key of ['price_nzd','test_cost_nzd','upside_nzd']) {
        assert.equal(r[key],null);
        assert.equal(r.economic_value_status[key],'UNKNOWN');
      }
      assert.equal(r.scoring.cost_known,false);
    }
    const zero=report.results.find(x=>x.opportunity_id==='zero');
    assert.equal(zero.test_cost_nzd,0);
    assert.equal(zero.economic_value_status.test_cost_nzd,'UNVERIFIED_DECLARATION');
    assert.equal(zero.scoring.zero_cost_is_unverified,true);
    assert.match(md,/Unknown amounts.*UNKNOWN.*UNKNOWN/);
    assert.match(md,/Declared zero.*NZ\$0 \(declared\)/);
    assert.equal(report.results.find(x=>x.opportunity_id==='blocked').verdict,'QUARANTINE');
    assert.equal(report.production_release_allowed,false);
    assert.equal(report.approval_required,true);
    for (const r of report.results) assert.equal(r.public_action,'APPROVAL_REQUIRED');
    const digest=report.integrity_sha256;
    delete report.integrity_sha256;
    assert.equal(crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex'),digest);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

process.stdout.write('PASS ' + cases + ' policy regression groups\n');
