'use strict';
const {URL}=require('url');

function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function normalizeTarget(x){
  return {
    artist:String(x.artist||'').trim(),
    title:String(x.title||'').trim(),
    pressing:String(x.pressing||'').trim(),
    catalog_number:String(x.catalog_number||'').trim(),
    max_landed_price_nzd:num(x.max_landed_price_nzd)
  };
}
function evaluateListing(target, listing){
  const price=num(listing.ask_price_nzd), shipping=num(listing.shipping_nzd), fees=num(listing.explicit_fees_nzd);
  const landed=price+shipping+fees;
  const pressingConfidence=num(listing.pressing_confidence);
  const match=String(listing.target_key||'').toLowerCase()===String(target.artist+'|'+target.title).toLowerCase();
  let state='OBSERVED';
  let reason='observed_listing';
  if(!match){state='REJECTED';reason='target_mismatch';}
  else if(target.max_landed_price_nzd>0 && landed<=target.max_landed_price_nzd && pressingConfidence>=0.8){
    state='BUY_CANDIDATE';reason='within_buyer_ceiling_and_pressing_confident';
  } else if(target.max_landed_price_nzd>0 && landed>target.max_landed_price_nzd){
    state='REJECTED';reason='above_buyer_ceiling';
  }
  return {...listing,landed_cost_nzd:Number(landed.toFixed(2)),truth_state:state,reason};
}
function handle(req,res){
  if(req.method!=='POST')return false;
  const u=new URL(req.url||'http://localhost/');
  if(u.pathname!=='/api/vinyl/evaluate')return false;
  let body='';
  req.on('data',c=>{body+=c;if(body.length>1000000)req.destroy();});
  req.on('end',()=>{
    try{
      const p=JSON.parse(body||'{}'), target=normalizeTarget(p.target||{}), listings=Array.isArray(p.listings)?p.listings:[];
      const evaluated=listings.map(x=>evaluateListing(target,x));
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      res.end(JSON.stringify({schema:'dreamledger/vinyl-hunter-evaluation/v1',target,evaluated,counts:{
        observed:evaluated.filter(x=>x.truth_state==='OBSERVED').length,
        buy_candidates:evaluated.filter(x=>x.truth_state==='BUY_CANDIDATE').length,
        rejected:evaluated.filter(x=>x.truth_state==='REJECTED').length
      },external_purchase_executed:false},null,2));
    }catch(e){res.writeHead(400,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:'invalid_json'}));}
  });
  return true;
}
module.exports={handle,evaluateListing};
