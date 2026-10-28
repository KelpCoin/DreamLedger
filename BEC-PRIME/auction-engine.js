'use strict';
// Existing BECK auction facade. Safe prelaunch: no authenticated, atomic Neon
// bid executor has been connected. NEVER pretend an unverified bid was accepted.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const AUCTION_DATA=path.resolve(process.env.AUCTION_DATA_PATH||path.join(__dirname,'data','auctions.json'));
const AUCTION_PROOFS=path.resolve(process.env.AUCTION_PROOF_DIR||path.join(__dirname,'data','proofs','auctions'));
function loadState(){
  if(!fs.existsSync(AUCTION_DATA))return {auctions:[],bids:[]};
  const data=JSON.parse(fs.readFileSync(AUCTION_DATA,'utf8'));
  return {auctions:Array.isArray(data.auctions)?data.auctions:[],bids:Array.isArray(data.bids)?data.bids:[]};
}
function saveState(state){
  fs.mkdirSync(path.dirname(AUCTION_DATA),{recursive:true});
  const tmp=AUCTION_DATA+'.tmp-'+process.pid+'-'+crypto.randomUUID();
  try{fs.writeFileSync(tmp,JSON.stringify(state,null,2)+'\n',{flag:'wx'});fs.renameSync(tmp,AUCTION_DATA);}
  finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
}
function approved(a,time=Date.now()){
  return Boolean(a && a.approved === true &&
    a.seller_verified === true && a.gauntlet_verdict === 'ALLOW' &&
    a.status === 'APPROVED' && Number.isFinite(Number(a.ends_at)) &&
    Number(a.ends_at)>time && Number(a.starts_at)<=time &&
    a.approval_required===false);
}
function publicAuction(a,bids,time=Date.now()){
  const trustedBids=bids.filter(b=>b.auction_id===a.auction_id &&
    b.trusted_neon_record===true && Number.isSafeInteger(b.amount_minor) &&
    b.amount_minor>0);
  const top=trustedBids.reduce((x,b)=>!x||b.amount_minor>x.amount_minor?b:x,null);
  const ended=Number(a.ends_at)<=time;
  return {
    auction_id:a.auction_id,product_id:a.product_id||null,silo:a.silo,
    title:a.title,description:a.description||'',currency:a.currency,
    start_price:a.start_price,current_price:top?top.amount_minor/100:a.start_price,
    reserve_price:a.reserve_price||0,reserve_met:top?top.amount_minor>=Math.round((a.reserve_price||0)*100):false,
    minimum_increment:a.minimum_increment,buy_now_price:a.buy_now_price||null,
    starts_at:a.starts_at,ends_at:a.ends_at,
    status:ended?'ENDED':a.status,approved:a.approved === true,
    seller_verified:a.seller_verified === true,
    gauntlet_verdict:a.gauntlet_verdict === 'ALLOW' ? 'ALLOW' : 'HOLD',
    bid_count:trustedBids.length,
    bidder_count:new Set(trustedBids.map(b=>b.bidder_id)).size,
    highest_bidder:null,approval_required:true,
    checkout_available:false,
    live_bidding_authorized:false,anti_sniping_seconds:a.anti_sniping_seconds||120,
    verified_settlement:false
  };
}
function createAuction(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('AUCTION_INPUT_REQUIRED');
  const allowedSilos=new Set(['SILO_MTG','SILO_MARKETPLACE','SILO_AVATAR','SILO_B2B']);
  if(!allowedSilos.has(input.silo))throw new Error('AUCTION_SILO_NOT_ALLOWED');
  if(typeof input.title!=='string'||input.title.trim().length<3||input.title.length>120)throw new Error('AUCTION_TITLE_REQUIRED');
  const amount=Number(input.start_price),end=Number(input.ends_at),start=Number(input.starts_at||Date.now());
  if(!Number.isFinite(amount)||amount<=0||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw new Error('AUCTION_PRICE_OR_WINDOW_INVALID');
  if((input.currency||'NZD')!=='NZD')throw new Error('AUCTION_FX_POLICY_UNVERIFIED');
  const state=loadState();
  const auction={
    auction_id:'AUC-'+crypto.randomUUID().toUpperCase(),product_id:input.product_id||null,
    silo:input.silo,title:input.title.trim(),description:String(input.description||'').slice(0,1500),
    currency:'NZD',start_price:amount,reserve_price:Number(input.reserve_price||0),
    minimum_increment:Number(input.minimum_increment||1),buy_now_price:null,
    starts_at:start,ends_at:end,anti_sniping_seconds:120,
    status:'DRAFT',approval_required:true,approved:false,seller_verified:false,
    gauntlet_verdict:'HOLD',checkout_available:false
  };
  if(!Number.isFinite(auction.reserve_price)||auction.reserve_price<0 ||
    !Number.isFinite(auction.minimum_increment)||auction.minimum_increment<=0)
    throw new Error('AUCTION_PRICING_INVALID');
  state.auctions.push(auction);
  saveState(state);
  return publicAuction(auction,state.bids);
}
function placeBid(){
  // No browser-generated bidder IDs, unlocked JSON files, or self bids.
  // Enable only through a separate, authenticated Neon SERIALIZABLE transaction,
  // bound to seller identity, Gauntlet ALLOW, reserve, anti-sniping and escrow.
  throw new Error('AUTHENTICATED_NEON_BID_EXECUTOR_REQUIRED');
}
function listAuctions(silo){
  const state=loadState(),t=Date.now();
  // IMPORTANT: read only. Expired lots NEVER refresh themselves.
  return state.auctions.filter(a=>(!silo||a.silo===silo)&&approved(a,t))
    .map(a=>publicAuction(a,state.bids,t));
}
function getAuction(id){return listAuctions().find(a=>a.auction_id===id)||null;}
module.exports={createAuction,placeBid,listAuctions,getAuction,AUCTION_DATA,AUCTION_PROOFS};
