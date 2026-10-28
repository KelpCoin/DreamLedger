'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {csvRows,slug}=require('./import-mtg-rapid-decks.cjs');
test('rapid CSV parses quoted commas and owner supplied fields',()=>{const r=csvRows('name,commander,price_nzd\n"Pirates, Ahoy","Edward Kenway",199\n');assert.deepEqual(r[1],['Pirates, Ahoy','Edward Kenway','199']);assert.equal(slug('Edward Kenway'),'EDWARD-KENWAY');});
test('public MTG shelf consumes canonical catalog and never upgrades inquiry stub to checkout',()=>{
 const h=fs.readFileSync('public/mtg/index.html','utf8');
 assert(h.includes("fetch('/catalog.json'"));
 assert(h.includes("p.sale_mode==='stripe_checkout'"));
 assert(h.includes("p.checkout_available===true"));
 assert(h.includes("p.id==='EDH_0001'"));
 assert(h.includes('Ask for decklist / buy details'));
 assert(h.includes('Available · ask to finish listing'));
 assert(h.includes('Commander: '));
 for(const m of h.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim()&&!m[0].includes('application/ld+json'))new vm.Script(m[1]);
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
