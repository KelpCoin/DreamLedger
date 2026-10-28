// Hermetic safety acceptance: a direct caller cannot charge through a held board.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const source=stripTypeScriptTypes(
 readFileSync('handlers/billboard-checkout.ts','utf8')
 .replace('export default async function handler','async function handler'),{mode:'strip'});
let network=0;
const ctx={process:{env:{STRIPE_SECRET_KEY:'DO_NOT_SEND',
 SUPABASE_URL:'https://mock.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'DO_NOT_SEND'}},
 fetch:()=>{network++;throw Error('NETWORK_REQUEST_WAS_NOT_ALLOWED');},
 URL,URLSearchParams,Response,Request,Number,String,JSON,Boolean,Array,Object,Math};
vm.runInNewContext(source+';globalThis.__handler=handler;',ctx);
const req=new Request('https://dreamledger.org/api/billboard-checkout',
 {method:'POST',headers:{'content-type':'application/json'},
 body:JSON.stringify({email:'buyer@example.invalid',market:'NZ',width:100,
 height:100,title:'Synthetic ad',destination_url:'https://example.org'})});
const result=await ctx.__handler(req);
const body=await result.json();
assert.equal(result.status,503);
assert.equal(body.error,'BILLBOARD_CHECKOUT_HELD');
assert.equal(body.charge_created,false);
assert.equal(network,0);
assert.equal((await ctx.__handler(new Request('https://dreamledger.org/api/billboard-checkout'))).status,405);
console.log('BECK_BILLBOARD_DIRECT_CHECKOUT_FAIL_CLOSED=PASS; NETWORK_CALLS='+network);
