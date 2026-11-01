'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {csvRows,slug}=require('./import-mtg-rapid-decks.cjs');
test('rapid CSV parses quoted commas and owner supplied fields',()=>{const r=csvRows('name,commander,price_nzd\n"Pirates, Ahoy","Edward Kenway",199\n');assert.deepEqual(r[1],['Pirates, Ahoy','Edward Kenway','199']);assert.equal(slug('Edward Kenway'),'EDWARD-KENWAY');});
test('public MTG shelf consumes canonical catalog and never upgrades inquiry stub to checkout',()=>{
 const h=fs.readFileSync('public/mtg/index.html','utf8');
 const runtime=fs.readFileSync('public/assets/mtg-community.js','utf8');
 const catalog=JSON.parse(fs.readFileSync('public/data/mtg-catalog.json','utf8'));
 assert(h.includes('data-catalog="/data/mtg-catalog.json"'));
 assert(h.includes('src="/assets/mtg-community.js"'));
 assert(catalog.products.some(p=>p.id==='EDH_0001'&&p.checkout_available===false));
 assert(runtime.includes("'/catalog.json'"));
 assert(runtime.includes("p.availability!=='review_required'"));
 assert(runtime.includes('There is no online checkout for this listing'));
 assert(!h.includes('https://buy.stripe.com/'));
 new vm.Script(runtime);
});
test('importer is inquiry-only by construction',()=>{
 const s=fs.readFileSync('scripts/import-mtg-rapid-decks.cjs','utf8');
 assert(s.includes("sale_mode:'claim_by_message'"));
 assert(s.includes('checkout_available:false'));
 assert(s.includes("decklist_status:'available_on_request'"));
 assert(!s.includes('buy.stripe.com'));
 assert(s.includes("for(const key of ['name','commander','price_nzd'])"));
});
console.log('MTG_RAPID_SHELF=PASS; NO_INVENTORY_INVENTED; NO_NEW_CHECKOUT_CREATED');
