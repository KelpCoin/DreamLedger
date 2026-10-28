'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os');
const fs=require('node:fs');
const path=require('node:path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'beck-auction-guard-'));
process.env.AUCTION_DATA_PATH=path.join(tmp,'auctions.json');
process.env.AUCTION_PROOF_DIR=path.join(tmp,'proofs');
const engine=require('../auction-engine');
function store(auctions,bids=[]){fs.writeFileSync(process.env.AUCTION_DATA_PATH,JSON.stringify({auctions,bids}));}
function lot(attrs={}){
return {auction_id:'fixture-1',product_id:'fixture',silo:'SILO_MARKETPLACE',
 title:'Sample only, not a buyer listing',description:'Synthetic test record',
 currency:'NZD',start_price:25,minimum_increment:1,reserve_price:0,
 starts_at:Date.now()-60000,ends_at:Date.now()-1,
 status:'live',checkout_available:true,approval_required:false,
 ...attrs};
}
test('no seeded or expired auction resurrects itself',()=>{
 const a=lot();
 store([a]);
 assert.deepEqual(engine.listAuctions(),[]);
 const after=JSON.parse(fs.readFileSync(process.env.AUCTION_DATA_PATH,'utf8'));
 assert.equal(after.auctions[0].ends_at,a.ends_at);
 assert.equal(after.auctions[0].status,a.status);
});
test('unapproved seller lots never shown as live, even with future end date',()=>{
 store([lot({ends_at:Date.now()+500000})]);
 assert.deepEqual(engine.listAuctions(),[]);
});
test('source cannot enable checkout or bids through untrusted input',()=>{
 store([]);
 const a=engine.createAuction({title:'Test only',silo:'SILO_MARKETPLACE',start_price:100,
 starts_at:Date.now(),ends_at:Date.now()+300000,approved:true,seller_verified:true,
 approval_required:false,checkout_available:true});
 assert.equal(a.checkout_available,false);
 assert.equal(a.approved,false);
 assert.equal(a.gauntlet_verdict,'HOLD');
 assert.throws(()=>engine.placeBid(a.auction_id,'bidder-from-localStorage',999),
  /AUTHENTICATED_NEON_BID_EXECUTOR_REQUIRED/);
 assert.deepEqual(engine.listAuctions(),[]);
});
test('trusted-looking file fixtures also cannot expose checkout or claim settlement',()=>{
 const f=lot({status:'APPROVED',approved:true,seller_verified:true,
 gauntlet_verdict:'ALLOW',ends_at:Date.now()+500000});
 store([f]);
 const items=engine.listAuctions();
 assert.equal(items.length,1);
 assert.equal(items[0].checkout_available,false);
 assert.equal(items[0].approval_required,true);
 assert.throws(()=>engine.placeBid(f.auction_id,'test-identity',101),
 /AUTHENTICATED_NEON_BID_EXECUTOR_REQUIRED/);
});
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
