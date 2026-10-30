'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const json = p => JSON.parse(read(p));
const checks=[];
function check(name,fn){
 try{fn();checks.push({name,status:'PASS'});console.log('PASS',name)}
 catch(e){checks.push({name,status:'FAIL',reason:e.message});console.error('FAIL',name,e.message);}
}
const mtg='public/mtg/index.html';
const hub='public/tcg/index.html';
const listing='public/tcg-list.html';
check('MTG source and public page agree',()=>assert.equal(read('mtg/index.html'),read(mtg)));
check('NZ MTG page provides clear preview and TCG navigation',()=>{
 const s=read(mtg);
 assert.match(s,/Commander catalogue previews/);
 assert.match(s,/Stock and payment not reserved|stock and shipping must be confirmed|stock and fulfilment are verified/i);
 assert.match(s,/href="\/tcg\/"/);
 assert.match(s,/href="\/mtg\/customize\/"/);
 assert.doesNotMatch(s,/href="https:\/\/buy\.stripe\.com/);
 assert.doesNotMatch(s,/<h2[^>]*>Decks for sale<\/h2>/);
});
check('MTG catalogue stays held and NZD400 owner price is unchanged',()=>{
 const p=json('BEC-PRIME/catalog/products/EDH_0001.json');
 const x=json('public/data/mtg-catalog.json').products.find(q=>q.id==='EDH_0001');
 assert.equal(p.price,40000);
 assert.equal(p.price_unit,'minor');
 assert.equal(p.inventory,0);
 assert.equal(p.checkout.enabled,false);
 assert.equal(x.price,400);
 assert.equal(x.inventory,0);
 assert.equal(x.checkout_available,false);
 const config=json('public/mtg/customize/EDH_0001.json');
 assert.equal(config.stock_checked,false);
 assert.equal(config.approved_for_public_checkout,false);
});
check('Manifest gives honest draft and community explanations',()=>{
 const m=json('public/silos/mtg/silo.json');
 assert.equal(m.slug,'mtg');
 assert.match(m.tagline,/private singles listing draft/);
 assert.ok(m.surface.hero_pills.some(s=>s.includes('Proposed')));
 assert.equal(m.clone.checkout_activation,'HOLD');
});
check('TCG directory is safe DOM and contains expected routes',()=>{
 const s=read(hub);
 assert.match(s,/aria-live="polite"/);
 assert.match(s,/textContent/);
 assert.match(s,/new Set\(\['mtg','pokemon','onepiece'/);
 assert.doesNotMatch(s,/innerHTML\s*=/);
 assert.doesNotMatch(s,/rank_gmv_q2_2026|Ranked from/);
 const d=json('public/data/tcg-swarm.json');
 const seen=new Set();
 for(const entry of d.silos){
  assert.match(entry.slug,/^[a-z]+$/);
  assert.ok(!seen.has(entry.slug));seen.add(entry.slug);
  assert.ok(fs.existsSync(path.join(root,'public',entry.slug,'index.html')),entry.slug+' page missing');
 }
 assert.equal(seen.size,8);
});
check('All TCG listing paths stay private and exportable',()=>{
 const s=read(listing);
 assert.match(s,/Private draft only/);
 assert.match(s,/localStorage\.setItem/);
 assert.match(s,/navigator\.clipboard/);
 assert.match(s,/new Blob/);
 assert.match(s,/URL\.createObjectURL/);
 assert.match(s,/form\.reportValidity/);
 assert.match(s,/price_nzd/);
 assert.doesNotMatch(s,/fetch\(|XMLHttpRequest|buy\.stripe\.com|<form[^>]+action=/i);
});
check('Legacy NZ deck pages do not promise attested stock',()=>{
 for(const slug of ['quintorius-field-historian','dwynen-gilt-leaf-daen']){
  const s=read('public/mtg/'+slug+'.html');
  assert.match(s,/Ask about availability/);
  assert.match(s,/Stock unverified/);
  assert.doesNotMatch(s,/1 in stock|Buy · NZ\$90|buy\.stripe\.com/i);
 }
});
check('Magic Scryfall draft has private copy and JSON export',()=>{
 const s=read('public/mtg-list.html');
 assert.match(s,/api\.scryfall\.com/);
 assert.match(s,/private listing draft|private Magic singles listing draft|Drafts save on this device/i);
 assert.match(s,/localStorage\.setItem/);
 assert.match(s,/navigator\.clipboard\.writeText/);
 assert.match(s,/new Blob/);
 assert.match(s,/Number\.isInteger\(qty\)/);
 assert.doesNotMatch(s,/Join free to publish|Join to publish|Sell a single<\/h1>/i);
});
check('Other TCG game pages explicitly describe previews',()=>{
 for(const slug of ['pokemon','onepiece','yugioh','lorcana','riftbound','gundam','digimon']){
  const s=read('public/'+slug+'/index.html');
  assert.match(s,/Automatic publishing, buyer matching and checkout are not live/);
  assert.match(s,/No listings are submitted from this game page/);
  assert.doesNotMatch(s,/Buy &amp; sell singles|>List free<\/a>|>Sell a single<\/a>/);
 }
});
check('Client scripts are syntactically valid',()=>{
 for(const p of [hub,listing,mtg,'public/mtg-list.html']){
  const source=read(p);
  const matches=[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.ok(matches.length,p+' has no script');
  for(const m of matches){try{new vm.Script(m[1],{filename:p});}catch(e){throw new Error(p+': '+e.message);}}
 }
});
const files=[mtg,hub,listing,'public/mtg-list.html','public/silos/mtg/silo.json'];
const proof={
 schema:'BECK/MTG-NZ-TCG-RELEASE-CONTRACT/v1',
 checked_at:new Date().toISOString(),
 status:checks.every(x=>x.status==='PASS')?'PASS':'FAIL',
 scope:'source-level held storefront and NZ TCG drafts; NOT production certification',
 evidence:checks,
 sha256:Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(read(p)).digest('hex')])),
 stock_attested:false,
 checkout_authorized:false,
 live_store_certified:false,
 paid_and_fulfilled_proof:null,
 public_release_approved:false
};
const output=path.join(root,'artifacts','mtg-nz-tcg-home-proof.json');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(proof,null,2)+'\n','utf8');
console.log('PROOF_FILE='+output);
console.log('RESULT='+proof.status+' | '+checks.filter(x=>x.status==='PASS').length+'/'+checks.length);
if(proof.status!=='PASS')process.exitCode=1;
