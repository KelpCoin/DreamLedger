'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const rail=require('../public/assets/mtg-auction-rail.js');
const data=JSON.parse(read('public/data/mtg-auctions.json'));
const now=Date.parse('2026-10-31T10:00:00Z');
function auction(id,minutes,seller='peer',extra={}){
 return {id,title:'Verified Card '+id,status:'open',silo:'mtg',currency:'NZD',seller_type:seller,starts_at:new Date(now-3600000).toISOString(),ends_at:new Date(now+minutes*60000).toISOString(),current_bid_nzd:40,public_verified:true,db_verified:true,...extra};
}
test('exactly three slots even when verified auction feed is empty',()=>{
 assert.equal(data.featured_slots,3);
 assert.equal(data.auction_slots.length,0);
 assert.equal(data.release.public_bidding_enabled,false);
 assert.equal(data.release.paid_featured_placements_enabled,false);
 assert.equal(data.promotion.purchase_enabled,false);
 assert.equal(rail.rank([],now).length,3);
 assert.deepEqual(rail.rank([],now),[null,null,null]);
});
test('organic ending soon order and distinct sellers',()=>{
 const items=[auction('A001',80,'peer'),auction('A002',15,'owner'),auction('A003',30,'peer'),auction('A004',4,'owner')];
 assert.deepEqual(rail.rank(items,now).map(x=>x.id),['A004','A002','A003']);
});
test('paid featured placements are explicitly verified and never create fake bids',()=>{
 const promoted=auction('B001',120,'peer',{promotion_paid_verified:true,promoted_slot:2});
 const organic=auction('B002',10,'peer');
 const second=auction('B003',20,'owner');
 const slots=rail.rank([promoted,organic,second],now);
 assert.deepEqual(slots.map(x=>x.id),['B002','B001','B003']);
 assert.equal(rail.validAuction(auction('B004',5,'peer',{public_verified:false}),now),false);
 assert.equal(rail.validAuction(auction('B005',-1),now),false);
 assert.equal(rail.validAuction(auction('B006',5,'peer',{currency:'USD'}),now),false);
 assert.equal(rail.validAuction(auction('B007',5,'peer',{status:'cancelled'}),now),false);
 assert.equal(rail.validAuction(auction('B008',5,'peer',{db_verified:false}),now),false);
});
test('countdown uses real close time, does not pretend to be live',()=>{
 assert.equal(rail.remaining(new Date(now-1000).toISOString(),now),'Ended');
 assert.equal(rail.remaining(new Date(now+90*1000).toISOString(),now),'00:01:30');
});
test('homepage and auction hub have shared rail; no active bid or paid placement controls',()=>{
 for(const p of ['public/mtg/index.html','public/mtg/auctions/index.html']){
  const h=read(p);
  assert.match(h,/id="mtgAuctionRail"/,p);
  assert.match(h,/mtg-auction-rail\.js/,p);
  assert.match(h,/dreamledger-mtg-theme\.css/,p);
  assert.doesNotMatch(h,/\/api\/auctions\/.*(?:bid|create)|buy\.stripe\.com/i,p);
 }
 const h=read('public/mtg/index.html');
 const pos=h.indexOf('id="mtgAuctionRail"'),hero=h.indexOf('class="mtg-hero"');
 assert.ok(pos>0&&pos<hero,'exactly three auction positions must precede the hero');
 const js=read('public/assets/mtg-auction-rail.js');
 assert.match(js,/promotion_paid_verified/);
 assert.match(js,/public_bidding_enabled===true/);
 assert.match(js,/db_verified===true/);
});
console.log('MTG auction rail proof: static test suite passed, commercial activation held');
