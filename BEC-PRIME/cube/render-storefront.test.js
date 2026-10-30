'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {compileSilo}=require('./clone-silo');
const {renderStorefront}=require('./render-storefront');
const {compileQueue,writeQueue,SCHEMA}=require('./cube-batch');
const master=require('./examples/mtg-master.json');
const other=require('./examples/baby-kids.example.json');
function hold(html){
 assert.match(html,/PRIVATE PREVIEW \/ CHECKOUT OFF/);
 assert.match(html,/Sellable products: 0/);
 assert.doesNotMatch(html,/buy\.stripe\.com|checkout\.stripe\.com|api\/payment\/create|Add to cart|Purchase now/i);
}
test('domain-neutral private web previews are responsive and do not imply stock',()=>{
 for(const config of [master,other]){
  const m=compileSilo(config),html=renderStorefront(m);
  hold(html);
  assert.match(html,/viewport/);
  assert.match(html,/noindex,nofollow/);
  assert.match(html,/connect-src 'none'/);
  assert.match(html,new RegExp(config.slug));
  assert.equal(html,renderStorefront(m));
 }
 const otherHtml=renderStorefront(compileSilo(other));
 assert.doesNotMatch(otherHtml,/DECK-A|card_name|Happy Homarid/);
});
test('candidate titles, brands and SKUs are HTML escaped, not executable',()=>{
 const c={...other,display_name:'"<script>alert(3)</script>',brand:{...other.brand,name:'<svg onload=alert(9)>'},
 seed_candidates:[{sku:'CANDIDATE-1',title:'<img src=x onerror=alert(7)>',price_minor:1200,attributes:{size:'2T'}}]};
 const h=renderStorefront(compileSilo(c));
 hold(h);
 assert.doesNotMatch(h,/<img src=x onerror=alert\(7\)>|<svg onload=alert\(9\)>|<script>alert\(3\)<\/script>/);
 assert.match(h,/&lt;img src=x onerror=alert\(7\)&gt;/);
 assert.match(h,/&lt;svg onload=alert\(9\)&gt;/);
 assert.match(h,/&lt;script&gt;alert\(3\)&lt;\/script&gt;/);
 assert.match(h,/data-title=/);
 assert.match(h,/id="query"/);
});
test('refuses accidentally promoted sale state or another silo contents',()=>{
 const x=compileSilo(master);
 x.catalogue.products.push({title:'Not verified'});
 assert.throws(()=>renderStorefront(x),/catalogue stock/);
 x.catalogue.products.length=0;
 x.health.silo_id='unrelated';
 assert.throws(()=>renderStorefront(x),/cross-silo/);
 x.health.silo_id=master.slug;
 x.manifest.checkout_enabled=true;
 assert.throws(()=>renderStorefront(x),/private draft/);
});
test('CUBE writes five private artifacts per niche plus deterministic proof',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cube-standalone-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const batch={schema:SCHEMA,jobs:[{task_id:'master-001',config:master},{task_id:'other-001',config:other}]};
 const dest=path.join(dir,'private'),one=writeQueue(batch,dest),two=writeQueue(batch,dest);
 assert.equal(one.proof_sha256,two.proof_sha256);
 assert.equal(one.status,'PRIVATE_DRAFT_ONLY');
 for(const slug of ['mtg','baby-kids']){
  const names=fs.readdirSync(path.join(dest,slug)).sort();
  assert.deepEqual(names,['catalogue.json','health-contract.json','preview.html','seed-review.json','silo.json']);
  hold(fs.readFileSync(path.join(dest,slug,'preview.html'),'utf8'));
 }
 const tampered=path.join(dest,'mtg','preview.html');
 fs.appendFileSync(tampered,'<b>TAMPERED</b>');
 assert.throws(()=>writeQueue(batch,dest),/existing silo differs/);
});
