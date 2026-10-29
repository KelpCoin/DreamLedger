'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {compileSilo} = require('./clone-silo');
const master = {
 slug:'mtg',display_name:'Happy Homarid Magic',locale:'en-NZ',jurisdiction:'NZ',
 currency:'NZD',inventory_mode:'physical',payment_provider:'stripe',
 brand:{name:'Happy Homarid',accent:'#d8b56b'},
 domain_fields:['card_name','set_code','condition','finish','decklist_url'],
 legal_pack:{required_policy_types:['consumer_terms','privacy','refunds','image_rights']},
 peer_fee_basis_points:0,
 seed_candidates:[{sku:'DECK-A',title:'An unverified reference deck',price_minor:9000,
  attributes:{card_name:'Reference only',condition:'review_needed'}}]
};
const baby = {
 slug:'baby-kids',display_name:'Baby & Kids',locale:'en-NZ',jurisdiction:'NZ',
 currency:'NZD',inventory_mode:'physical',payment_provider:'external',
 brand:{name:'Baby & Kids',accent:'#ffb9ba'},
 domain_fields:['size','age_range','safety_disclosures','condition_photos'],
 legal_pack:{required_policy_types:['consumer_terms','privacy','returns','product_safety']},
 peer_fee_basis_points:0,
 seed_candidates:[{sku:'BABY-CLOTHES-1',title:'Example pre-owned sweater',price_minor:1200,
  attributes:{size:'2T',age_range:'18-24 months'}}]
};
test('MTG is an input fixture, not a hard-coded engine category',()=>{
 const out=compileSilo(master);
 assert.equal(out.manifest.slug,'mtg');
 assert.deepEqual(out.manifest.domain_fields,master.domain_fields);
 assert.equal(out.manifest.inventory_authority,'marketplace.supply_attestations');
 assert.equal(out.catalogue.products.length,0);
 assert.equal(out.manifest.checkout_enabled,false);
 assert.equal(out.health.status,'HOLD_NOT_READY');
 assert.equal(out.seedReview.candidates[0].quantity_available,0);
});
test('unrelated domain uses identical schema and no copied card inventory',()=>{
 const a=compileSilo(master),b=compileSilo(baby);
 assert.equal(a.manifest.schema,b.manifest.schema);
 assert.equal(a.catalogue.schema,b.catalogue.schema);
 assert.equal(b.manifest.slug,'baby-kids');
 assert.equal(b.manifest.payment_provider,'external');
 assert.deepEqual(b.manifest.domain_fields,baby.domain_fields);
 assert.ok(!JSON.stringify(b).includes('Happy Homarid'));
 assert.ok(!JSON.stringify(b).includes('DECK-A'));
 assert.equal(b.catalogue.checkout_enabled,false);
 assert.equal(b.seedReview.candidates[0].checkout_available,false);
});
test('arbitrary new domain, currency and non-sale community compile without code edits',()=>{
 const out=compileSilo({...baby,slug:'community-art',currency:'EUR',
  payment_provider:'none',inventory_mode:'service',seed_candidates:[]});
 assert.equal(out.manifest.currency,'EUR');
 assert.equal(out.manifest.payment_provider,'none');
 assert.equal(out.manifest.route,'/community-art/');
 assert.equal(out.catalogue.products.length,0);
});
test('completely deterministic output for identical config',()=>{
 assert.deepEqual(compileSilo(baby),compileSilo(baby));
 assert.equal(JSON.stringify(compileSilo(master)),JSON.stringify(compileSilo(master)));
});
test('never allow unreviewed domain field injection, identity or secret material',()=>{
 assert.throws(()=>compileSilo({...baby,seed_candidates:[{sku:'X-1',title:'Test',
  price_minor:12,attributes:{card_name:'MTG leaked'}}]}),/undeclared domain field/);
 assert.throws(()=>compileSilo({...baby,secret:'unsafe'}),/forbidden input/);
 assert.throws(()=>compileSilo({...baby,brand:{name:'x',accent:'#ffb9ba',api_key:'hidden'}}),/forbidden input/);
 assert.throws(()=>compileSilo({...baby,slug:'../../other'}),/slug invalid/);
});
test('invalid price, fees, currency, duplicate seed and dangerous locale fail closed',()=>{
 assert.throws(()=>compileSilo({...baby,peer_fee_basis_points:10001}),/peer fee/);
 assert.throws(()=>compileSilo({...baby,currency:'N$'}),/currency/);
 assert.throws(()=>compileSilo({...baby,seed_candidates:[{...baby.seed_candidates[0],price_minor:NaN}]}),/price_minor/);
 assert.throws(()=>compileSilo({...baby,seed_candidates:[baby.seed_candidates[0],baby.seed_candidates[0]]}),/duplicate/);
 assert.throws(()=>compileSilo({...baby,locale:''}),/locale/);
});
test('legacy clone contract no longer assumes a fixed list, NZD and Stripe product',()=>{
 const c=JSON.parse(fs.readFileSync(path.join(__dirname,'CUBE-CLONE-CONTRACT.json'),'utf8'));
 assert.equal(c.schema_version,'CUBE-CLONE-CONTRACT-2.0');
 assert.ok(!('allowed_silos' in c));
 assert.ok(!c.required_inputs.includes('price_nzd'));
 assert.ok(!c.required_inputs.includes('stripe_product_id'));
 assert.ok(c.activation.never_auto_publish);
});

test('compiled candidate conforms to generic manifest schema without domain surgery',()=>{
 const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'CUBE-CLONE-MANIFEST.schema.json'),'utf8'));
 for(const config of [master,baby]){
  const manifest=compileSilo(config).manifest;
  for(const key of schema.required)assert.ok(Object.hasOwn(manifest,key),key);
  for(const key of Object.keys(manifest))assert.ok(Object.hasOwn(schema.properties,key),key);
  for(const [key,rule] of Object.entries(schema.properties))
   if(Object.hasOwn(rule,'const'))assert.equal(manifest[key],rule.const,key);
 }
 assert.equal(schema.additionalProperties,false);
 assert.ok(!schema.required.includes('price_nzd'));
 assert.ok(!schema.required.includes('stripe_product_id'));
});
