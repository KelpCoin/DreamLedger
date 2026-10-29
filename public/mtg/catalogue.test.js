'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const api=require('./catalogue.js');
const page=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const staticCatalogue=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','mtg-catalog.json'),'utf8'));
const row={
 id:'00000000-0000-4000-8000-000000000001',
 silo_id:'mtg',status:'published',sku:'EDH-TEST',title:'Safe listing',description:'Factory sealed',
 category:'commander-deck',price_minor:5000,currency:'nzd',quantity:1,
 checkout_url:'https://malicious.invalid/checkout',seller_email:'private@example.invalid'
};
test('the public master does not expose hardcoded Stripe or fallback stock',()=>{
 assert.doesNotMatch(page,/buy\\.stripe\\.com|checkout_url|FALLBACK|Buy securely - NZ/);
 assert.match(page,/\/mtg\/catalogue\\.js/);
 assert.match(page,/Explore Commander deck references/);
 assert.match(page,/Server-listed inventory/);
});
test('static catalogue is historical reference and never authorizes stock or checkout',()=>{
 assert.equal(staticCatalogue.catalogue_authority,'HISTORICAL_REFERENCE_ONLY_NO_STOCK_AUTHORITY');
 for(const x of staticCatalogue.products) {
   assert.equal(x.inventory,0,x.sku);
   assert.equal(x.status,'reference_only',x.sku);
   assert.equal(x.checkout_available,false,x.sku);
   assert.equal(x.checkout_url,undefined,x.sku);
 }
});
test('only matched live MTG items can be displayed as server-listed stock',()=>{
 assert.equal(api.selectItems({schema:'CUBE/B2B-MARKETPLACE/v2',source:'neon',items:[row]}).length,1);
 for(const changed of [{silo_id:'adult'}, {status:'draft'}, {quantity:0},
                      {currency:'usd'},{price_minor:-1},{price_minor:'Infinity'}]){
   assert.throws(()=>api.selectItems({schema:'CUBE/B2B-MARKETPLACE/v2',source:'neon',items:[{...row,...changed}]}));
 }
});
test('untrusted listing HTML and checkout links never leave display adapter',()=>{
 const render=api.renderItem(api.publicItem({...row,title:'<img src=x onerror=alert(1)>',description:'<script>evil</script>'}));
 assert.doesNotMatch(render,/<script>|<img src=x|malicious\\.invalid|private@example/);
 assert.match(render,/&lt;script&gt;evil&lt;\/script&gt;/);
 assert.match(render,/mailto:hello@dreamledger.org/);
});
test('schema mismatch or no server inventory cannot fall back to static products',async()=>{
 await assert.rejects(api.loadLive(async()=>({ok:true,json:async()=>({products:[row]})})),/INVALID_CATALOGUE_CONTRACT/);
 let urlSeen=null;
 const items=await api.loadLive(async(url,opts)=>{urlSeen=url;assert.equal(opts.cache,'no-store');
  return {ok:true,json:async()=>({schema:'CUBE/B2B-MARKETPLACE/v2',source:'neon',items:[]})};
 });
 assert.deepEqual(items,[]);
 assert.equal(urlSeen,'/api/cube/marketplace?silo=mtg&limit=100');
});
test('site has clear failure state and zero checkout calls when backend fails',async()=>{
 const els={status:{textContent:''},grid:{innerHTML:'legacy'}};
 const result=await api.mount({getElementById:x=>els[x]},async()=>{throw Error('db down')});
 assert.equal(result.state,'INVENTORY_UNVERIFIED');
 assert.equal(els.grid.innerHTML,'');
 assert.match(els.status.textContent,/unavailable/);
});
