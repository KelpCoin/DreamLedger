// BECK regional internet billboard: hermetic publication and source tests.
// Never creates a checkout, publishes user art, changes a DB, or counts revenue.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const html=readFileSync('public/billboard.html','utf8');
assert.match(html, /id="board-market"/);
assert.match(html, /id="billboard-canvas"/);
assert.match(html, /Checkout temporarily held/);
assert.doesNotMatch(html, /id="checkout" href="https:\/\/buy\.stripe\.com/);
assert.match(html, /marketSelect\.addEventListener\('change',draw\)/);
for(const code of ['GLOBAL','NZ','AU','ZA','AMERICAS','EUROPE','NZ-AKL','NZ-WLG','NZ-CHC','NZ-HBC','US','GB'])
 assert.match(html,new RegExp('value="'+code+'"'));
const ts=readFileSync('handlers/billboard-public.ts','utf8');
const source=stripTypeScriptTypes(ts.replace('export default async function handler','async function handler'),{mode:'strip'});
const records=[
 {campaign_id:'C1',title:'NZ published',market:'NZ',status:'PUBLISHED',x:0,y:0,width:100,height:100,
  owner_email:'SENSITIVE-DO-NOT-EXPOSE',destination_url:'https://example.org'},
 {campaign_id:'C2',title:'AU pending',market:'AU',status:'PAID_PENDING_REVIEW',x:0,y:0,width:100,height:100},
 {campaign_id:'C3',title:'Global wide',market:'GLOBAL',status:'PUBLISHED',x:800,y:900,width:200,height:100},
 {campaign_id:'C4',title:'Unknown region',market:'?',status:'PUBLISHED',x:900,y:900,width:100,height:100},
 {campaign_id:'C5',title:'Legacy missing coordinates',market:'NZ',status:'PUBLISHED'},
 {campaign_id:'C6',title:'Wrong grid alignment',market:'NZ',status:'PUBLISHED',x:15,y:0,width:100,height:100},
 {campaign_id:'C7',title:'Actual Auckland',market:'NZ-AKL',status:'PUBLISHED',x:500,y:300,width:100,height:100}
];
let fetchStatus=200;
const context={
 process:{env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-fixture'}},
 fetch:async()=>new Response(JSON.stringify(records),{status:fetchStatus}),
 Response,Request,URL,AbortSignal,Set,String,Number,Object,Array,Boolean,JSON
};
vm.runInNewContext(source+';globalThis.__handler=handler;',context,{filename:'billboard-public.ts'});
const handler=context.__handler;
const response=await handler(new Request('https://dreamledger.org/api/billboard/public'));
assert.equal(response.status,200);
const output=await response.json();
assert.equal(output.items.length,6,'only published records may appear');
assert.equal(output.verified_external_revenue_claim,false);
assert.equal(output.physical_screen_inventory_verified,false);
assert(!JSON.stringify(output).includes('SENSITIVE-DO-NOT-EXPOSE'));
const byId=Object.fromEntries(output.items.map(x=>[x.id,x]));
assert.equal(byId.C1.geometry.cell_index,0);
assert.equal(byId.C3.geometry.x,800);
assert.equal(byId.C3.geometry.width,200);
assert.equal(byId.C3.cell_index,null,'multi-cell asset is not a single cell');
assert.equal(byId.C4.market,'UNSPECIFIED','cannot assign missing market to NZ by default');
assert.equal(byId.C5.geometry,null);
assert.equal(byId.C6.geometry,null);
assert.equal(byId.C7.market,'NZ-AKL');
assert.equal(byId.C7.geometry.cell_index,35);
fetchStatus=503;
const failure=await handler(new Request('https://dreamledger.org/api/billboard/public'));
assert.equal(failure.status,503,'missing publication evidence must fail closed');
console.log('BECK_REGIONAL_BILLBOARD_HERMETIC=PASS; PHYSICAL_DOOH_VERIFIED=NO; LIVE_PAYMENT_UNTOUCHED=YES');