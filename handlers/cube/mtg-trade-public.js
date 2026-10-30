'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUERY='SELECT marketplace.mtg_trade_public_receipt($1::uuid) AS receipt';
function respond(res,status,obj){
 res.statusCode=status;
 res.setHeader('content-type','application/json; charset=utf-8');
 res.setHeader('cache-control','no-store');
 res.setHeader('x-content-type-options','nosniff');
 res.setHeader('referrer-policy','no-referrer');
 res.end(JSON.stringify(obj));
}
function createHandler(deps={}){
 const env=deps.env||(()=>process.env);
 const db=deps.db||((url)=>{
  const driver=require('@neondatabase/serverless').neon(url);
  return (sql,args)=>driver.query(sql,args);
 });
 return async function(req,res){
  if(req.method!=='GET')return respond(res,405,{error:'METHOD_NOT_ALLOWED'});
  const cfg=env();
  if(cfg.MTG_TRADE_LEDGER_ENABLED!=='true'||!cfg.NEON_DATABASE_URL)
   return respond(res,503,{error:'PUBLIC_RECEIPTS_NOT_RELEASED'});
  const u=new URL(String(req.url||'/'),'https://dreamledger.org');
  if(u.searchParams.size!==1||!u.searchParams.has('trade_id')||
    !UUID.test(u.searchParams.get('trade_id')||''))
   return respond(res,400,{error:'TRADE_ID_REQUIRED'});
  try {
   const rows=await db(cfg.NEON_DATABASE_URL)(QUERY,[u.searchParams.get('trade_id')]);
   if(!Array.isArray(rows)||rows.length!==1)throw Error('DATABASE_UNAVAILABLE');
   const item=rows[0]?.receipt;
   if(!item)return respond(res,404,{error:'RECEIPT_NOT_PUBLIC'});
   if(typeof item!=='object' || item.schema!=='dreamledger/mtg-trade-public-receipt/v1'||
      item.silo!=='dreamledger-mtg'||item.both_agreed!==true||
      !/^[0-9a-f]{64}$/.test(item.terms_sha256||''))
     throw Error('BAD_RECEIPT_PROJECTION');
   // Whitelist projection to avoid accidentally exposing new private SQL fields.
   const keys=['schema','silo','trade_id','status','party_a_label','party_b_label',
     'both_agreed','agreed_at_utc','completed_at_utc','dispatched_a','dispatched_b',
     'received_a','received_b','party_a_gives','party_b_gives','cash_minor','currency',
     'handoff','terms_sha256','latest_event_sha256','event_count',
     'provider_payment_verified','independent_external_anchor',
     'evidence_is_tamper_evident_not_legal_finality'];
   return respond(res,200,Object.fromEntries(keys.map(k=>[k,item[k]])));
  }catch{
   return respond(res,503,{error:'PUBLIC_RECEIPT_UNAVAILABLE'});
  }
 };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
module.exports.QUERY=QUERY;
