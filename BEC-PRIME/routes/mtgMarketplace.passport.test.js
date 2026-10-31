'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Readable}=require('node:stream');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'mtg-open-market-'));
process.env.DREAMIEZ_DATA_DIR=path.join(root,'legacy');
process.env.DREAMLEDGER_MTG_LEDGER_DIR=path.join(root,'mtg');
const {handle}=require('./mtgMarketplace.js');
test.after(()=>fs.rmSync(root,{recursive:true,force:true}));
async function req(method,endpoint,data,ip,cookie){
 const r=Readable.from(data?[JSON.stringify(data)]:[]);
 r.method=method;r.url=endpoint;r.headers=cookie?{cookie}:{};r.socket={remoteAddress:ip||'203.0.113.22'};
 let status=200,response='';
 const w={writableEnded:false,writeHead(code){status=code;return this;},end(s){response=s;this.writableEnded=true;return this;}};
 const handled=await handle(r,w,endpoint);
 assert.equal(handled,true);
 return {status,data:JSON.parse(response)};
}
test('accountless guest listing can publish, expose a direct contact and be removed by secret',async()=>{
 const data={title:'Sol Ring',condition:'Near Mint',price_nzd:12,accepts_buy:true,accepts_trade:true,
   seller_display_name:'KiwiCardCollector',contact_url:'https://example.org/trader/kiwi',
   trader_status:'private',description:'NM, NZ shipping available'};
 const created=await req('POST','/api/mtg/marketplace/list',data);
 assert.equal(created.status,201);
 assert.equal(created.data.publication_state,'ACTIVE');
 assert.equal(created.data.fee_nzd,0);
 assert.match(created.data.guest_owner_token,/^[a-f0-9]{64}$/);
 const listed=await req('GET','/api/mtg/marketplace/listings');
 assert.equal(listed.data.listings.length,1);
 assert.equal(listed.data.listings[0].contact_url,'https://example.org/trader/kiwi');
 assert(!JSON.stringify(listed).includes(created.data.guest_owner_token));
 const stored=JSON.parse(fs.readFileSync(path.join(root,'legacy','mtg-marketplace-listings.json'),'utf8'));
 assert.equal(stored[0].seller_compliance.legal_name,null);
 assert.equal(stored[0].seller_compliance.captured_ip,null);
 assert(!JSON.stringify(stored).includes(created.data.guest_owner_token));
 const denied=await req('POST','/api/mtg/marketplace/list/remove',
   {listing_id:created.data.listing.id,owner_token:'invalid'});
 assert.equal(denied.status,403);
 const gone=await req('POST','/api/mtg/marketplace/list/remove',
   {listing_id:created.data.listing.id,owner_token:created.data.guest_owner_token});
 assert.equal(gone.status,200);
 const after=await req('GET','/api/mtg/marketplace/listings');
 assert.equal(after.data.listings.length,0);
});
test('two-person trade receipt works without account or settlement claims',async()=>{
 const created=await req('POST','/api/mtg/marketplace/trade/create',{
   seller_handle:'AucklandTrader',seller_offers:'Sol Ring NM',
   seller_wants:'Arcane Signet LP',terms:'Both send tracked NZ Post'},'203.0.113.76');
 assert.equal(created.status,201);
 const {trade_id,seller_token,invitation_token}=created.data;
 const file=path.join(root,'mtg','private-trade-passports.json');
 assert(fs.existsSync(file));
 const stored=fs.readFileSync(file,'utf8');
 assert(!stored.includes(seller_token));
 assert(!stored.includes(invitation_token));
 const joined=await req('POST','/api/mtg/marketplace/trade/join',{
   trade_id,invitation_token,buyer_handle:'QueenStreetCards'});
 assert.equal(joined.status,200);
 const buyer_token=joined.data.buyer_token;
 const invalid=await req('POST','/api/mtg/marketplace/trade/agree',
   {trade_id,role:'buyer',token:seller_token});
 assert.equal(invalid.status,422);
 for(const [role,token] of [['seller',seller_token],['buyer',buyer_token]]){
   const answer=await req('POST','/api/mtg/marketplace/trade/agree',{trade_id,role,token});
   assert.equal(answer.status,200);
 }
 for(const [role,token] of [['seller',seller_token],['buyer',buyer_token]]){
   const answer=await req('POST','/api/mtg/marketplace/trade/complete',{trade_id,role,token});
   assert.equal(answer.status,200);
 }
 const rating=await req('POST','/api/mtg/marketplace/trade/feedback',{
   trade_id,role:'buyer',token:buyer_token,rating:'positive',comment:'Great accurate card condition'});
 assert.equal(rating.status,200);
 assert.equal(rating.data.reputation_credit,0);
 const view=await req('POST','/api/mtg/marketplace/trade/view',{
   trade_id,role:'seller',token:seller_token});
 assert.equal(view.data.trade.status,'PEER_REPORTED_COMPLETE');
 assert.equal(view.data.trade.feedback.buyer,undefined);
 assert.equal(view.data.trade.identity_verified,false);
 assert.equal(view.data.trade.platform_fee_nzd,0);
});

test('registered sellers also need no government name or home address',async()=>{
 const file=path.join(root,'legacy','users.json');
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify([{id:'account-test-1',email:'sample@example.com',
   name:'TraderAlias',seller:{display_name:'TraderAlias'}}]));
 const data={title:'Arcane Signet',condition:'Near Mint',price_nzd:5,accepts_buy:true,
   trader_status:'private',description:'Clean single available locally'};
 const created=await req('POST','/api/mtg/marketplace/list',data,'203.0.113.23',
   'dreamiez_session=account-test-1');
 assert.equal(created.status,201);
 const rows=JSON.parse(fs.readFileSync(path.join(root,'legacy','mtg-marketplace-listings.json'),'utf8'));
 const item=rows.find(x=>x.title==='Arcane Signet');
 assert.equal(item.seller_compliance.legal_name,null);
 assert.equal(item.seller_compliance.contact_address,null);
 assert.equal(created.data.guest_owner_token,null);
});
