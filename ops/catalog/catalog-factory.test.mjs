import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { candidateDigest, compileCatalogue, verifyGauntlet } from './catalog-factory.mjs';
import { productBlockers, runProvisioner } from './stripe-link-provisioner.mjs';

const SEED_CHECKS = [
  'schema_valid','source_provenance','buyer_hypothesis','silo_boundary',
  'rights_and_privacy','duplicate_sku','truth_boundary'
];
const PRODUCT_CHECKS = ['demand_evidence','price_integrity','unit_economics','fulfillment_test','delivery_receipt'];
const shaA = 'a'.repeat(64);
const shaB = 'b'.repeat(64);

function candidate(sku, silo, ready=true) {
  return {
    sku, silo, kind:'digital_product', name:'Test '+sku,
    description:'Bounded digital deliverable used by automated catalogue tests.',
    source:{ref:'fixture://source/'+sku,sha256:shaA},
    demand:{buyer_segment:'Test developers',status:'SUPPORTED',evidence_ref:'fixture://demand/'+sku},
    price:ready?{currency:'nzd',unit_amount_minor:2500,billing_mode:'one_time'}:null,
    unit_economics:ready?{status:'PASS',estimated_cost_minor:100}: {status:'UNVERIFIED'},
    fulfillment:ready?{status:'PASS',contract_id:'FUL-'+sku,delivery_mode:'signed_download',test_ref:'fixture://test/'+sku,test_sha256:shaB}: {status:'UNVERIFIED'}
  };
}
function record(sku,silo,ready=true,overrides={}) {
  const c=candidate(sku,silo,ready);
  const checks=[...SEED_CHECKS,...(ready?PRODUCT_CHECKS:[])].map(id=>({id,status:'PASS'}));
  const rec={
    schema_version:'dreamledger/catalog-candidate/v1',
    candidate:c,
    gauntlet:{status:'PASS',run_id:'test-run-'+sku,completed_at:'2026-10-15T10:00:00.000Z',candidate_sha256:'',checks},
    elohim:{iteration:0,proposals:[]},
    commercial_review:ready?{status:'APPROVED',approved_by:'test-reviewer',approved_at:'2026-10-15T10:01:00.000Z'}:{status:'PENDING'},
    checkout:ready?{live_activation_approved:true,approved_by:'test-reviewer',approved_at:'2026-10-15T10:02:00.000Z'}:{live_activation_approved:false}
  };
  rec.gauntlet.candidate_sha256=candidateDigest(rec);
  rec.elohim.candidate_sha256=rec.gauntlet.candidate_sha256;
  return {...rec,...overrides};
}
function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(),'dreamledger-catalog-'));
}
function writeNdjson(file,rows) {
  fs.writeFileSync(file,rows.map(x=>JSON.stringify(x)).join('\n')+'\n');
}
function registry(silos) {
  return {schema_version:'dreamledger/silo-registry/v1',silos};
}

test('only fully gated product becomes PRODUCT_READY; passed incomplete candidate becomes seed', async () => {
  const root=tempRoot();
  const input=path.join(root,'input.ndjson');
  const reg=path.join(root,'registry.json');
  const out=path.join(root,'out');
  writeNdjson(input,[
    record('DEV-API-WRAPPER-001','developer-assets',true),
    record('CREATIVE-MIDI-PACK-001','creative-media',false),
    record('B2B-COMPLIANCE-002','b2b-compliance',false,{gauntlet:{status:'FAIL',run_id:'failed-run',completed_at:'2026-10-15T10:00:00.000Z',candidate_sha256:'0'.repeat(64),checks:SEED_CHECKS.map(id=>({id,status:'PASS'}))}})
  ]);
  fs.writeFileSync(reg,JSON.stringify(registry([
    {slug:'developer-assets',live_checkout_enabled:true},
    {slug:'creative-media',live_checkout_enabled:false},
    {slug:'b2b-compliance',live_checkout_enabled:false}
  ])));
  const result=await compileCatalogue({input,registryPath:reg,outdir:out,maxRecords:100});
  assert.equal(result.totals.products,1);
  assert.equal(result.totals.seeds,1);
  assert.equal(result.totals.rejected,1);
  const products=fs.readFileSync(path.join(out,'products.ndjson'),'utf8').trim().split('\n').map(JSON.parse);
  const seeds=fs.readFileSync(path.join(out,'seeds.ndjson'),'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(products[0].factory.state,'PRODUCT_READY');
  assert.equal(productBlockers(products[0]).length,0);
  assert.equal(seeds[0].factory.state,'GAUNTLET_PASSED_SEED');
  assert.equal(seeds[0].factory.public_listing,false);
  assert.equal(result.outputs.live_checkout_created,false);
});

test('all occurrences of a duplicate SKU are rejected', async () => {
  const root=tempRoot();
  const input=path.join(root,'input.ndjson');
  const reg=path.join(root,'registry.json');
  const out=path.join(root,'out');
  writeNdjson(input,[
    record('B2B-COMPLIANCE-001','b2b-compliance',false),
    record('B2B-COMPLIANCE-001','b2b-compliance',false,{candidate:{...candidate('B2B-COMPLIANCE-001','b2b-compliance',false),name:'Different item'}})
  ]);
  const rows=fs.readFileSync(input,'utf8').trim().split('\n').map(JSON.parse);
  for(const row of rows) row.gauntlet.candidate_sha256=candidateDigest(row);
  writeNdjson(input,rows);
  fs.writeFileSync(reg,JSON.stringify(registry([{slug:'b2b-compliance',live_checkout_enabled:false}])));
  const result=await compileCatalogue({input,registryPath:reg,outdir:out,maxRecords:100});
  assert.equal(result.totals.duplicates,1);
  assert.equal(result.totals.seeds,0);
  assert.equal(result.totals.products,0);
  assert.equal(result.totals.rejected,2);
});

test('candidate digest drift invalidates the original Gauntlet PASS', () => {
  const row=record('DEV-API-WRAPPER-099','developer-assets',false);
  row.candidate.description='Elohim changed this content after the last Gauntlet run.';
  assert.equal(verifyGauntlet(row).passed,false);
  assert.ok(verifyGauntlet(row).failures.includes('GAUNTLET_CANDIDATE_DIGEST_MISMATCH'));
});

test('Stripe provisioner remains dry-run by default and revalidates product gates', async () => {
  const root=tempRoot();
  const input=path.join(root,'products.ndjson');
  const state=path.join(root,'state.ndjson');
  const row=record('DEV-API-WRAPPER-123','developer-assets',true);
  row.factory={state:'PRODUCT_READY',candidate_sha256:row.gauntlet.candidate_sha256,live_checkout_enabled_for_silo:true};
  writeNdjson(input,[row]);
  const result=await runProvisioner({input,state,limit:25,dryRun:true});
  assert.equal(result.mode,'DRY_RUN');
  assert.equal(result.created_count,0);
  assert.equal(result.results[0].state,'DRY_RUN');
  assert.equal(result.results[0].would_create_active_link,true);
  assert.equal(fs.existsSync(state),true);
});

test('streams 10,000 Gauntlet-passed candidate seeds without creating products', async () => {
  const root=tempRoot();
  const input=path.join(root,'input.ndjson');
  const reg=path.join(root,'registry.json');
  const out=path.join(root,'out');
  const rows=[];
  for(let i=1;i<=10000;i++) {
    rows.push(JSON.stringify(record('LOAD-SEED-'+String(i).padStart(6,'0'),'developer-assets',false)));
  }
  fs.writeFileSync(input,rows.join('\n')+'\n');
  fs.writeFileSync(reg,JSON.stringify(registry([{slug:'developer-assets',live_checkout_enabled:false}])));
  const result=await compileCatalogue({input,registryPath:reg,outdir:out,maxRecords:10000});
  assert.equal(result.totals.source_records,10000);
  assert.equal(result.totals.seeds,10000);
  assert.equal(result.totals.products,0);
  assert.equal(result.totals.rejected,0);
  assert.equal(result.silos['developer-assets'].seed_count,10000);
});

test('hypothesis-only candidates can become gated seeds but not products', async () => {
  const root=tempRoot();
  const input=path.join(root,'input.ndjson');
  const reg=path.join(root,'registry.json');
  const out=path.join(root,'out');
  const row=record('B2B-COMPLIANCE-HYPOTHESIS-001','b2b-compliance',false);
  row.candidate.demand={buyer_segment:'Compliance leads evaluating reusable policy tooling',status:'HYPOTHESIS',evidence_ref:null};
  row.gauntlet.checks=SEED_CHECKS.map(id=>({id,status:'PASS'}));
  row.gauntlet.candidate_sha256=candidateDigest(row);
  row.elohim.candidate_sha256=row.gauntlet.candidate_sha256;
  writeNdjson(input,[row]);
  fs.writeFileSync(reg,JSON.stringify(registry([{slug:'b2b-compliance',live_checkout_enabled:false}])));
  const result=await compileCatalogue({input,registryPath:reg,outdir:out,maxRecords:10});
  assert.equal(result.totals.seeds,1);
  assert.equal(result.totals.products,0);
  const seed=JSON.parse(fs.readFileSync(path.join(out,'seeds.ndjson'),'utf8').trim());
  assert.equal(seed.candidate.demand.status,'HYPOTHESIS');
  assert.ok(seed.factory.product_blockers.includes('DEMAND_EVIDENCE_NOT_PROVEN'));
});
