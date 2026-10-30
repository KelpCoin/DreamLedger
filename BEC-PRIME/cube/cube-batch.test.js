'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {compileQueue,writeQueue,SCHEMA}=require('./cube-batch');
const mtg=require('./examples/mtg-master.json');
const baby=require('./examples/baby-kids.example.json');
const gameConfig={slug:'kelphaven',display_name:'KelpHaven Avatar World',locale:'en-NZ',jurisdiction:'NZ',currency:'NZD',inventory_mode:'digital',payment_provider:'none',peer_fee_basis_points:0,brand:{name:'KelpHaven',accent:'#19758a'},domain_fields:['avatar_style','world_zone','cosmetic_class'],legal_pack:{required_policy_types:['community_rules','privacy','digital_goods']},seed_candidates:[]};
const queue={schema:SCHEMA,jobs:[{task_id:'job-003',config:gameConfig},{task_id:'job-001',config:mtg},{task_id:'job-002',config:baby}]};
test('one CUBE compiler, three unrelated domains, no published inventory or money',()=>{
 const r=compileQueue(queue);
 assert.deepEqual(r.jobs.map(x=>x.task_id),['job-001','job-002','job-003']);
 assert.equal(r.public_published,false);
 assert.equal(r.paid_orders_verified,null);
 for(const j of r._private_jobs){
  const manifest=JSON.parse(j.contents['silo.json']);
  const catalog=JSON.parse(j.contents['catalogue.json']);
  assert.equal(manifest.checkout_enabled,false);
  assert.equal(manifest.public_approved,false);
  assert.equal(catalog.products.length,0);
  assert.equal(JSON.parse(j.contents['seed-review.json']).public,false);
 }
});
test('same manifest and same input produce identical SHA',()=>{
 const a=compileQueue(queue),b=compileQueue(queue);
 assert.deepEqual(a.jobs,b.jobs);
 assert.equal(a._private_jobs[0].digest,b._private_jobs[0].digest);
});
test('secret and personal data keys fail closed',()=>{
 for(const config of [{...baby,api_token:'leak'},{...baby,brand:{...baby.brand,private_key:'secret'}},{...baby,seed_candidates:[{sku:'X-1',title:'x',price_minor:10,attributes:{size:'sk_live_abcd1234567'}}]}]){
  assert.throws(()=>compileQueue({schema:SCHEMA,jobs:[{task_id:'job-001',config}]}),/confidential|credential/);
 }
});
test('cannot activate or override payment state through job',()=>{
 const q={schema:SCHEMA,jobs:[{task_id:'job-001',config:gameConfig,checkout_enabled:true}]};
 assert.throws(()=>compileQueue(q),/unexpected job/);
 assert.throws(()=>compileQueue({schema:SCHEMA,jobs:[{task_id:'job-001',config:{...gameConfig,public_approved:true}}]},()=>({manifest:{slug:'kelphaven',state:'active',checkout_enabled:true},catalogue:{products:[{}]}})),/unsupported config key/);
});
test('duplicate ids, duplicate slugs, bad currency, overflow reject',()=>{
 assert.throws(()=>compileQueue({schema:SCHEMA,jobs:[{task_id:'job-001',config:mtg},{task_id:'job-001',config:baby}]}),/duplicate task/);
 assert.throws(()=>compileQueue({schema:SCHEMA,jobs:[{task_id:'job-001',config:mtg},{task_id:'job-002',config:mtg}]}),/duplicate compiled slug/);
 assert.throws(()=>compileQueue({schema:SCHEMA,jobs:[{task_id:'job-001',config:{...baby,currency:'N$'}}]}),/currency/);
 assert.throws(()=>compileQueue({schema:SCHEMA,jobs:Array.from({length:26},(_,i)=>({task_id:'job-'+i,config:{...baby,slug:'baby-'+i}}))}),/job count/);
});
test('idempotent private write, no overwritten files, proof hashes',t=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'cube-sw-'));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const output=path.join(base,'batch-001');
 const first=writeQueue(queue,output),second=writeQueue(queue,output);
 assert.equal(first.proof_sha256,second.proof_sha256);
 assert.equal(fs.readdirSync(output).length,4);
 assert.equal(first.status,'PRIVATE_DRAFT_ONLY');
 assert.equal(fs.readFileSync(path.join(output,'mtg','silo.json'),'utf8').includes('"checkout_enabled": false'),true);
 fs.writeFileSync(path.join(output,'mtg','silo.json'),'CORRUPT');
 assert.throws(()=>writeQueue(queue,output),/existing silo differs/);
});
test('public paths are always rejected',()=>{
 const publicDir=path.resolve(__dirname,'..','..','public');
 assert.throws(()=>writeQueue(queue,path.join(publicDir,'batch')),/public/);
});
test('public symlink ancestry is rejected',t=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'cube-sym-'));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const publicDir=path.resolve(__dirname,'..','..','public');
 const link=path.join(base,'link');
 try{fs.symlinkSync(publicDir,link,'dir');}catch(e){t.diagnostic('Host forbids creating symlink');return;}
 assert.throws(()=>writeQueue(queue,path.join(link,'child')),/public/);
});
test('MTG data cannot leak into KelpHaven candidate, game commerce remains disabled',()=>{
 const j=compileQueue(queue)._private_jobs.find(j=>j.slug==='kelphaven');
 const json=Object.values(j.contents).join('\n');
 assert.doesNotMatch(json,/Happy Homarid|DECK-A|baby-kids/);
 assert.equal(JSON.parse(j.contents['silo.json']).payment_provider,'none');
 assert.equal(JSON.parse(j.contents['silo.json']).inventory_mode,'digital');
});
