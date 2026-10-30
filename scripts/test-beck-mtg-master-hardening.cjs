'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const mtg=JSON.parse(read('public/data/mtg-catalog.json'));
const global=JSON.parse(read('public/catalog.json'));
const legacy=JSON.parse(read('BEC-PRIME/catalog/products/EDH_0001.json'));
const manifest=JSON.parse(read('public/silos/mtg/silo.json'));
test('public MTG and global catalogues agree while paid activation is held',()=>{
 const g=new Map(global.products.map(p=>[p.id,p]));
 for(const p of mtg.products.filter(p=>p.status==='published')){
  const other=g.get(p.id);
  assert.ok(other,'missing global SKU '+p.id);
  assert.equal(Number(other.price),Number(p.price),p.id+' price');
  assert.equal(Boolean(other.checkout_available),Boolean(p.checkout_available),p.id+' permission');
  assert.equal(p.checkout_available,false,'unproven purchase capability '+p.id);
 }
 assert.equal(legacy.status,'held');
 assert.equal(legacy.commercial_truth.sellable,false);
 assert.equal(manifest.clone.public_activation,'HOLD');
});
test('checkout bypasses and unverified diagnostic CTA are absent',()=>{
 const routes=read('BEC-PRIME/routes/platformCart.js');
 assert.match(routes,/silos\.some\(s=>s\.toLowerCase\(\)==='mtg'\)/);
 assert.match(routes,/String\(p\?\.silo\|\|''\)\.toLowerCase\(\)==='mtg'/);
 const preload=read('BEC-PRIME/lib/mtgRoutePreload.js');
 assert.match(preload,/MTG checkout held: atomic stock reservation/);
 for(const p of ['public/mtg/index.html','mtg/index.html','BEC-PRIME/compiled/website/mtg/index.html','BEC-PRIME/website/mtg-catalog.html']){
  const html=read(p);
  assert.doesNotMatch(html,/>Buy diagnostic<\/a>/);
  assert.doesNotMatch(html,/See cards &amp; buy/);
  assert.match(html,/catalog\.json/);
 }
});
test('CUBE generator is empty, offline, and allowlisted',()=>{
 const script=read('BEC-PRIME/cube/CUBE-Clone-Silo.ps1');
 assert.match(script,/if \(\$CreateRemote -or \$Push\)/);
 assert.doesNotMatch(script,/Copy-Item -Recurse/);
 assert.match(script,/inherited_inventory=0/);
 assert.match(script,/checkout_enabled=\$false/);
 assert.match(script,/public_activation='HOLD'/);
});
test('public and compiled master surfaces are byte-identical',()=>{
 assert.equal(read('public/mtg/index.html'),read('BEC-PRIME/compiled/website/mtg/index.html'));
 assert.equal(read('public/mtg/index.html'),read('mtg/index.html'));
});
