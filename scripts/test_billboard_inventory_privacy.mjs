// No real Stripe, Supabase, or public network calls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const source=stripTypeScriptTypes(
 readFileSync('handlers/billboard-inventory.ts','utf8')
  .replace('export default async function handler','async function handler'),
 {mode:'strip'});
let status=200;
let lastRequest='';
const rows=[
 {campaign_id:'published-001',market:'NZ',status:'PUBLISHED',
  x:0,y:0,width:100,height:100,owner_email:'PRIVATE-PUBLISHED-OWNER'},
 {campaign_id:'pending-001',market:'NZ',status:'PAID_PENDING_REVIEW',
  x:100,y:0,width:100,height:100,title:'SECRET-UNAPPROVED-TITLE',
  destination_url:'https://secret.example.org',owner_email:'PRIVATE-CUSTOMER-EMAIL'}
];
const ctx={process:{env:{SUPABASE_URL:'https://fixture.supabase.co',
 SUPABASE_SERVICE_ROLE_KEY:'dummy-fixture-key'}},URL,Response,Request,AbortSignal,
 fetch:async(url)=>{lastRequest=String(url);return new Response(JSON.stringify(rows),{status});},
 JSON,Number,String,Object,Array,Boolean};
vm.runInNewContext(source+';globalThis.__handler=handler;',ctx);
const handler=ctx.__handler;
const response=await handler(new Request('https://dreamledger.org/api/billboard-inventory?market=NZ'));
assert.equal(response.status,200);
const data=await response.json();
assert.equal(data.published_placements,1);
assert.equal(data.held_pending_review_count,1);
assert.equal(data.used_founding_units,2);
assert.equal(data.checkout_available,false);
assert.equal(data.physical_dooh_screen_inventory,false);
assert.equal(data.published_geometry.length,1);
assert(!lastRequest.includes('owner_email'));
assert(!lastRequest.includes('title'));
assert(!lastRequest.includes('destination_url'));
assert(!JSON.stringify(data).includes('SECRET-UNAPPROVED'));
assert(!JSON.stringify(data).includes('PRIVATE-CUSTOMER'));
assert.equal((await handler(new Request('https://dreamledger.org/api/billboard-inventory?market=INVALID'))).status,400);
status=503;
assert.equal((await handler(new Request('https://dreamledger.org/api/billboard-inventory?market=NZ'))).status,503);
console.log('BECK_BILLBOARD_ANONYMOUS_INVENTORY_PRIVACY=PASS');
