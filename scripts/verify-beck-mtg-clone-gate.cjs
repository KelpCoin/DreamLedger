'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const root=path.join(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const mtg=JSON.parse(read('public/data/mtg-catalog.json'));
const global=JSON.parse(read('public/catalog.json'));
const manifest=JSON.parse(read('public/silos/mtg/silo.json'));
const byId=new Map(global.products.map(p=>[p.id,p]));
const conflicts=[];
for(const p of mtg.products.filter(p=>p&&p.status==='published')){
  const x=byId.get(p.id);
  if(!x||x.status!==p.status||Number(x.price)!==Number(p.price)||
      String(x.currency||global.currency_default).toUpperCase()!==String(p.currency||mtg.currency).toUpperCase()||
      Boolean(x.checkout_available)!==Boolean(p.checkout_available)||
      (p.checkout_available&&x.checkout_url!==p.checkout_url)) conflicts.push(p.id);
}
assert.equal(manifest.inventory_policy,'empty_until_verified_supply');
for(const p of ['public/mtg/index.html','mtg/index.html','BEC-PRIME/compiled/website/mtg/index.html','BEC-PRIME/website/mtg-catalog.html']){
 const src=read(p);
 assert.ok(src.includes('/catalog.json'),'missing independent catalogue reference: '+p);
 assert.ok(!src.includes('See cards &amp; buy'),'physical checkout CTA not held: '+p);
 assert.ok(/checkout held|checkout is not offered|stock-verified|confirm before payment/i.test(src),'no physical checkout hold: '+p);
}
const preload=read('BEC-PRIME/lib/mtgRoutePreload.js');
assert.ok(preload.includes("MTG checkout held: atomic stock reservation"),'server route not held');
const clone=read('BEC-PRIME/cube/CUBE-Clone-Silo.ps1');
assert.ok(clone.includes("status='SYNTHETIC_PRIVATE_ONLY'"));
assert.ok(!clone.includes("Copy-Item -Recurse"));
assert.ok(clone.includes('if ($CreateRemote -or $Push)'));

const legacy=JSON.parse(read('BEC-PRIME/catalog/products/EDH_0001.json'));
const edh=mtg.products.find(p=>p.id==='EDH_0001');
assert.ok(edh && Number(edh.price)===400);
assert.equal(edh.checkout_available,false);
assert.equal(edh.checkout_url,null);
assert.equal(edh.inventory,0);
assert.equal(legacy.status,'held');
assert.equal(legacy.commercial_truth.approval_required,true);
assert.equal(legacy.commercial_truth.sellable,false);
const cart=read('BEC-PRIME/routes/platformCart.js');
assert.ok(cart.includes("if(silos.some(s=>s.toLowerCase()==='mtg'))"),'MTG cart must fail closed');
assert.ok(cart.includes("String(p?.silo||'').toLowerCase()==='mtg'"),'product checkout must fail closed');
for(const p of ['BEC-PRIME/compiled/website/mtg/index.html','BEC-PRIME/website/mtg-catalog.html']){
  assert.ok(!read(p).includes('>Buy diagnostic</a>'),'unverified diagnostic payment link exposed: '+p);
}

const output={
 schema:'BECK/MTG-GOLDEN-MASTER-SAFETY-CHECK/v2',
 safety_controls:'STATIC_PASS',
 catalogues_reconciled:conflicts.length===0,
 conflicts,
 physical_checkout:'HELD_UNTIL_ATOMIC_RESERVATION_PROOF',
 clone_generator:'PRIVATE_EMPTY_ALLOWLIST_ONLY',
 diagnostic_checkout:'HELD_UNTIL_DELIVERY_PROOF',
 legacy_stripe_link_state:'EXTERNAL_STATUS_UNVERIFIED',
 live_database_race_test:'NOT_RUN',
 stripe_reconciliation_test:'NOT_RUN',
 tenant_isolation_test:'NOT_RUN',
 master_commerce_certification:'HOLD',
 mass_clone_activation:'HOLD'
};
console.log(JSON.stringify(output,null,2));
