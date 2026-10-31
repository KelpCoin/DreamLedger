/* DreamLedger MTG auction rail. Verified records only, three slots, no fake timers. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.MTGAuctionRail=api})(typeof window!=='undefined'?window:null,function(){
'use strict';
const TARGET='/mtg/auctions/';
function validAuction(a,now){
 if(!a||typeof a!=='object')return false;
 const close=Date.parse(a.ends_at||''),open=Date.parse(a.starts_at||'');
 return typeof a.id==='string'&&/^[A-Za-z0-9_-]{4,80}$/.test(a.id)&&typeof a.title==='string'&&a.title.trim().length>=3&&a.title.length<=180&&
  ['owner','peer'].includes(a.seller_type)&&a.status==='open'&&a.silo==='mtg'&&a.currency==='NZD'&&
  a.public_verified===true&&a.db_verified===true&&Number.isFinite(close)&&close>now&&Number.isFinite(open)&&open<=now&&
  typeof a.current_bid_nzd==='number'&&Number.isFinite(a.current_bid_nzd)&&a.current_bid_nzd>=0&&a.current_bid_nzd<=1000000;
}
function rank(auctions,now,promotionsEnabled=false){
 const all=Array.isArray(auctions)?auctions.filter(a=>validAuction(a,now)):[];
 const promoted=all.filter(a=>promotionsEnabled&&a.promotion_paid_verified===true&&Number.isInteger(a.promoted_slot)&&a.promoted_slot>=1&&a.promoted_slot<=3)
  .sort((a,b)=>a.promoted_slot-b.promoted_slot||Date.parse(a.ends_at)-Date.parse(b.ends_at));
 const chosen=[],seen=new Set(),slots=[null,null,null];
 for(const a of promoted){if(!slots[a.promoted_slot-1]&&!seen.has(a.id)){slots[a.promoted_slot-1]=a;seen.add(a.id)}}
 const organic=all.filter(a=>!seen.has(a.id)).sort((a,b)=>Date.parse(a.ends_at)-Date.parse(b.ends_at));
 let i=0;
 for(let n=0;n<3;n++)if(!slots[n])slots[n]=organic[i++]||null;
 return slots;
}
function remaining(end,now){
 const sec=Math.ceil((Date.parse(end)-now)/1000);
 if(!Number.isFinite(sec)||sec<=0)return 'Ended';
 const d=Math.floor(sec/86400),h=Math.floor(sec%86400/3600),m=Math.floor(sec%3600/60),s=sec%60;
 return d>0?d+'d '+String(h).padStart(2,'0')+'h':String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}
function el(tag,className,value){const n=document.createElement(tag);if(className)n.className=className;if(value!==undefined)n.textContent=String(value);return n}
function render(target,source,now){
 if(!target)return {shown:0};
 const list=rank(source?.auction_slots,now,source?.release?.paid_featured_placements_enabled===true),verified=source?.schema==='dreamledger/mtg-auction-surface/v1'&&source?.silo==='mtg'&&source?.release?.public_bidding_enabled===true;
 const cards=[];
 for(let i=0;i<3;i++){
  const a=verified?list[i]:null,article=el('article','mtg-auction-slot'),top=el('div','mtg-auction-slot-top'),body=el('div','mtg-auction-slot-body');
  top.append(el('span','mtg-auction-num','0'+(i+1)));
  top.append(el('span','mtg-auction-pill',a?(source?.release?.paid_featured_placements_enabled===true&&a.promotion_paid_verified&&a.promoted_slot===i+1?'FEATURED · PAID PLACEMENT':'ENDING SOON'):'POSITION OPEN'));
  body.append(el('div','mtg-auction-kind',a?(a.seller_type==='owner'?'DREAMLEDGER OWNER AUCTION':'PLAYER-TO-PLAYER AUCTION'):'NZ MTG · AUCTION SPOTLIGHT'));
  body.append(el('h3','',a?a.title:['The next big card.','A collector’s next find.','Your next winning bid.'][i]));
  if(a){
   body.append(el('p','mtg-auction-description','Verified listing · '+(a.seller_type==='owner'?'DreamLedger inventory':'Independent community seller')));
   const row=el('div','mtg-auction-metrics'),bid=el('div',''),time=el('div','');
   bid.append(el('small','','CURRENT BID'),el('strong','','NZ$'+a.current_bid_nzd.toFixed(2)));
   time.append(el('small','','ENDS IN'),el('strong','mtg-auction-countdown',remaining(a.ends_at,now)));
   time.lastChild.dataset.endsAt=a.ends_at;row.append(bid,time);body.append(row);
   const aLink=el('a','mtg-button primary','View auction ↗');aLink.href=TARGET+'?id='+encodeURIComponent(a.id);body.append(aLink);
  }else{
   body.append(el('p','mtg-auction-description','No verified auction is running in this position yet. Free auction participation is planned. No fake bids or countdowns.'));
   const link=el('a','mtg-button','Auction details ↗');link.href=TARGET;body.append(link);
  }
  article.append(top,body);cards.push(article);
 }
 target.replaceChildren(...cards);
 return {shown:verified?list.filter(Boolean).length:0,slots:3};
}
async function init(){
 const rail=document.getElementById('mtgAuctionRail');if(!rail)return;
 async function load(){
  try{const response=await fetch('/data/mtg-auctions.json',{cache:'no-store'});if(!response.ok)throw Error('Unavailable');
   const doc=await response.json();
   if(doc.schema!=='dreamledger/mtg-auction-surface/v1'||doc.silo!=='mtg')throw Error('Invalid auction feed');
   render(rail,doc,Date.now());
   const status=document.getElementById('mtgAuctionStatus');
   if(status)status.textContent=doc.release?.public_bidding_enabled?'Auction positions update from verified records.':'Auction bidding is being prepared. Three featured positions are reserved; no auction or sponsored placement is live yet.';
  }catch(_){render(rail,{schema:'dreamledger/mtg-auction-surface/v1',silo:'mtg'},Date.now());const status=document.getElementById('mtgAuctionStatus');if(status)status.textContent='Auction feed unavailable. No bids or paid placements are being accepted.'}
 }
 await load();
 setInterval(()=>{for(const n of rail.querySelectorAll('[data-ends-at]'))n.textContent=remaining(n.dataset.endsAt,Date.now())},1000);
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init()}
return {rank,validAuction,remaining,render};
});
