'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Readable}=require('node:stream');
const data=fs.mkdtempSync(path.join(os.tmpdir(),'dreamledger-agents-'));
process.env.DREAMIEZ_DATA_DIR=data;
const commerce=require('./MarketplaceCommerce');
const fixture=[1,2,3,4].map(n=>({
  id:'listing_'+n,seller_id:'seller',seller_name:'Seller',
  title:'MTG test '+n,description:'Unit test only',category:'mtg',
  price:25,quantity:1,reserved:0,sold:0,status:'APPROVED'
}));
fs.mkdirSync(path.dirname(commerce.paths.LISTINGS),{recursive:true});
fs.writeFileSync(commerce.paths.LISTINGS,JSON.stringify(fixture));
fs.writeFileSync(path.join(data,'users.json'),JSON.stringify([
{id:'a',email:'a@example.invalid',email_verified:true},
{id:'b',email:'b@example.invalid',email_verified:true}
]));
function readListings(){return JSON.parse(fs.readFileSync(commerce.paths.LISTINGS,'utf8'))}
function req(method,url,obj={},user='a',key='k'){
  const r=Readable.from([JSON.stringify(obj)]);
  r.method=method;r.url=url;
  r.headers={'cookie':'dreamiez_session='+user,'idempotency-key':key};
  return r;
}
async function api(method,url,obj,user,key){
  const response={status:null,headers:{},raw:'',
    writeHead(code,headers){this.status=code;this.headers=headers;},
    end(value){this.raw=value;}};
  const handled=await commerce.handle(req(method,url,obj,user,key),response,url);
  assert.equal(handled,true);
  return {status:response.status,body:JSON.parse(response.raw)};
}
test('two buyers using same idempotency key never see each other cart',()=>{
  const a=commerce.reserveCart('a',[{listing_id:'listing_1',quantity:1}],'shared-merchant-key');
  const b=commerce.reserveCart('b',[{listing_id:'listing_2',quantity:1}],'shared-merchant-key');
  assert.equal(a.cart.buyer_id,'a');
  assert.equal(b.cart.buyer_id,'b');
  assert.notEqual(a.cart.id,b.cart.id);
  assert.equal(readListings().find(x=>x.id==='listing_1').reserved,1);
  assert.equal(readListings().find(x=>x.id==='listing_2').reserved,1);
});
test('same buyer and key is idempotent only for identical cart inputs',()=>{
  const original=commerce.reserveCart('a',[{listing_id:'listing_1',quantity:1}],'shared-merchant-key');
  assert.equal(original.cart.buyer_id,'a');
  assert.throws(()=>commerce.reserveCart('a',[{listing_id:'listing_3',quantity:1}],'shared-merchant-key'),
    e=>e.statusCode===409&&/payload_changed/.test(e.message));
});
test('expired cart cannot be resurrected using replay key',()=>{
  commerce.reserveCart('a',[{listing_id:'listing_3'}],'expires-test');
  const rows=JSON.parse(fs.readFileSync(commerce.paths.CARTS,'utf8'));
  const cart=rows.find(x=>x.items.some(i=>i.listing_id==='listing_3'));
  cart.expires_at='2020-01-01T00:00:00Z';
  fs.writeFileSync(commerce.paths.CARTS,JSON.stringify(rows));
  assert.throws(()=>commerce.reserveCart('a',[{listing_id:'listing_3'}],'expires-test'),
    e=>e.statusCode===409&&/expired/.test(e.message));
  assert.equal(readListings().find(x=>x.id==='listing_3').reserved,0);
});
test('legacy replay without owner field still requires original response buyer',()=>{
  const a=commerce.reserveCart('a',[{listing_id:'listing_4'}],'legacy-test');
  const keys=JSON.parse(fs.readFileSync(commerce.paths.IDEMPOTENCY,'utf8'));
  const hit=keys.find(x=>x.key==='legacy-test');delete hit.owner_id;
  fs.writeFileSync(commerce.paths.IDEMPOTENCY,JSON.stringify(keys));
  const same=commerce.reserveCart('a',[{listing_id:'listing_4'}],'legacy-test');
  assert.equal(a.cart.id,same.cart.id);
  assert.throws(()=>commerce.reserveCart('b',[{listing_id:'listing_4'}],'legacy-test'),e=>e.statusCode===409);
});
test('agent catalogue actually resolves from advertised v2 route',async()=>{
  const r=await api('GET','/api/marketplace/v2/agent-catalog',{},'a','');
  assert.equal(r.status,200);
  assert.equal(r.body.schema,'dreamledger.marketplace.agent_catalog.v1');
  assert.equal(r.body.payment_enabled,false);
  assert.ok(Array.isArray(r.body.listings));
});
test('offer replay with colliding key stays inside verified buyer account',async()=>{
  const url='/api/marketplace/v2/offers';
  const a=await api('POST',url,{listing_id:'listing_1',amount_nzd:20},'a','same-offer-key');
  assert.equal(a.status,201);
  const b=await api('POST',url,{listing_id:'listing_2',amount_nzd:18},'b','same-offer-key');
  assert.equal(b.status,201);
  assert.equal(a.body.offer.buyer_id,'a');
  assert.equal(b.body.offer.buyer_id,'b');
  assert.notEqual(a.body.offer.id,b.body.offer.id);
  const repeat=await api('POST',url,{listing_id:'listing_1',amount_nzd:20},'a','same-offer-key');
  assert.equal(repeat.status,200);
  assert.equal(repeat.body.offer.id,a.body.offer.id);
});
