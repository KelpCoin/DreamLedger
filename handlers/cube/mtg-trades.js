'use strict';
const session=require('../../BEC-PRIME/compiled/website/lib/signedSession');
const ACCOUNT=/^u_[a-f0-9]{24}$/;
const HASH=/^[0-9a-f]{64}$/;
const KEY=/^[A-Za-z0-9_-]{16,128}$/;
const UUID=/^[0-9a-f-]{36}$/i;
const QUERIES={
 propose:'SELECT marketplace.mtg_trade_propose($1::text,$2::text,$3::jsonb,$4::text) AS receipt',
 act:'SELECT marketplace.mtg_trade_act($1::text,$2::uuid,$3::text,$4::text,$5::text) AS receipt',
 receipt:'SELECT marketplace.mtg_trade_receipt($1::text,$2::uuid) AS receipt'
};
function reply(res,code,body){
 res.statusCode=code;
 res.setHeader('content-type','application/json; charset=utf-8');
 res.setHeader('cache-control','private, no-store');
 res.setHeader('x-content-type-options','nosniff');
 res.end(JSON.stringify(body));
}
function validateTerms(t){
 if(!t||typeof t!=='object'||Array.isArray(t))throw Error('INVALID_TERMS');
 if(Object.keys(t).sort().join(',')!=='cash_minor,handoff,notes,party_a_gives,party_b_gives')
   throw Error('INVALID_TERMS');
 if(!Number.isSafeInteger(t.cash_minor)||Math.abs(t.cash_minor)>100000000||
   !['tracked_shipping','in_person'].includes(t.handoff)||
   typeof t.notes!=='string'||t.notes.length>1000)throw Error('INVALID_TERMS');
 const normalize=(cards)=>{
  if(!Array.isArray(cards)||cards.length<1||cards.length>100)throw Error('INVALID_CARDS');
  return cards.map(c=>{
   if(!c||typeof c!=='object'||Array.isArray(c)||
     Object.keys(c).sort().join(',')!=='collector_number,condition,finish,name,photo_sha256,quantity,set'||
     typeof c.name!=='string'||c.name.trim().length<2||c.name.length>160||
     typeof c.set!=='string'||! /^[A-Za-z0-9]{2,8}$/.test(c.set)||
     typeof c.collector_number!=='string'||! /^[A-Za-z0-9*+-]{1,14}$/.test(c.collector_number)||
     !['nonfoil','foil','etched'].includes(c.finish)||
     !['NM','LP','MP','HP','DMG'].includes(c.condition)||
     !Number.isInteger(c.quantity)||c.quantity<1||c.quantity>100||
     !Array.isArray(c.photo_sha256)||c.photo_sha256.length>8||
     c.photo_sha256.some(h=>typeof h!=='string'||!HASH.test(h)))throw Error('INVALID_CARD');
   return {name:c.name.trim(),set:c.set.toUpperCase(),collector_number:c.collector_number,
    finish:c.finish,condition:c.condition,quantity:c.quantity,photo_sha256:c.photo_sha256};
  });
 };
 const out={schema:'dreamledger/mtg-trade-terms/v1',silo:'dreamledger-mtg',
  party_a_gives:normalize(t.party_a_gives),party_b_gives:normalize(t.party_b_gives),
  handoff:t.handoff,cash_minor:t.cash_minor,currency:'NZD',notes:t.notes.trim(),
  platform_fee_minor:0,external_fees_not_included:true};
 if(Buffer.byteLength(JSON.stringify(out))>15000)throw Error('TERMS_TOO_LARGE');
 return out;
}
function createHandler(deps={}){
 const env=deps.env||(()=>process.env);
 const db=deps.db||((url)=>require('@neondatabase/serverless').neon(url).query);
 const identity=deps.identity||session.fromCookie;
 return async function(req,res){
  const cfg=env();
  if(cfg.MTG_TRADE_LEDGER_ENABLED!=='true'||!cfg.NEON_DATABASE_URL||
    typeof cfg.DREAMLEDGER_SESSION_SECRET!=='string'||
    cfg.DREAMLEDGER_SESSION_SECRET.length<32||
    typeof cfg.DREAMLEDGER_PUBLIC_ORIGIN!=='string')
    return reply(res,503,{error:'TRADE_LEDGER_NOT_RELEASED'});
  const actor=identity(req.headers?.cookie,cfg.DREAMLEDGER_SESSION_SECRET);
  if(!ACCOUNT.test(actor||''))return reply(res,401,{error:'LOGIN_REQUIRED'});
  if(!['GET','POST'].includes(req.method))return reply(res,405,{error:'METHOD_NOT_ALLOWED'});
  if(req.method==='POST'&&
    (req.headers?.origin!==cfg.DREAMLEDGER_PUBLIC_ORIGIN||
    !String(req.headers?.['content-type']||'').startsWith('application/json')))
    return reply(res,403,{error:'CROSS_ORIGIN_REJECTED'});
  try{
   let sql,args;
   if(req.method==='GET'){
    const params=new URL(req.url,'https://dreamledger.org').searchParams;
    const id=params.get('trade_id');
    if(params.size!==1||!UUID.test(id||''))return reply(res,400,{error:'TRADE_ID_REQUIRED'});
    sql=QUERIES.receipt;args=[actor,id];
   }else{
    const b=req.body;
    if(!b||typeof b!=='object'||Array.isArray(b))return reply(res,400,{error:'INVALID_REQUEST'});
    if(b.action==='propose'){
     if(Object.keys(b).sort().join(',')!=='action,idempotency_key,party_b,terms'||
       !ACCOUNT.test(b.party_b||'')||b.party_b===actor||!KEY.test(b.idempotency_key||''))
       return reply(res,400,{error:'INVALID_PROPOSAL'});
     sql=QUERIES.propose;args=[actor,b.party_b,JSON.stringify(validateTerms(b.terms)),b.idempotency_key];
    }else{
     if(!['accept','decline','cancel','dispute'].includes(b.action)||
       !UUID.test(b.trade_id||'')||!KEY.test(b.idempotency_key||'')||
       !HASH.test(b.terms_sha256||'')||
       (b.action==='accept'&&b.acknowledge_exact_terms!==true)||
       (b.action!=='accept'&&b.acknowledge_exact_terms!==undefined)||
       !Object.keys(b).every(k=>['action','trade_id','idempotency_key','terms_sha256','acknowledge_exact_terms'].includes(k)))
       return reply(res,400,{error:'INVALID_ACTION'});
     sql=QUERIES.act;args=[actor,b.trade_id,b.action,b.terms_sha256,b.idempotency_key];
    }
   }
   const rows=await db(cfg.NEON_DATABASE_URL)(sql,args);
   if(!Array.isArray(rows)||rows.length!==1||!rows[0].receipt)
     throw Error('MISSING_RECEIPT');
   const rec=rows[0].receipt;
   if(!rec||typeof rec!=='object'||typeof rec.trade_id!=='string')
     throw Error('INVALID_RECEIPT');
   return reply(res,req.method==='POST'&&req.body.action==='propose'?201:200,rec);
  }catch(e){
   const msg=String(e.message||'');
   if(/TRADE_(TERMS_CHANGED|STATE_CONFLICT|IDEMPOTENCY_CONFLICT)/.test(msg))
    return reply(res,409,{error:'TRADE_CONFLICT'});
   if(/TRADE_NOT_FOUND/.test(msg))return reply(res,404,{error:'TRADE_NOT_FOUND'});
   if(/INVALID_(TERMS|CARDS|CARD)|TERMS_TOO_LARGE/.test(msg))
    return reply(res,400,{error:'INVALID_TRADE_TERMS'});
   return reply(res,503,{error:'TRADE_LEDGER_UNAVAILABLE'});
  }
 };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
module.exports.validateTerms=validateTerms;
module.exports.QUERIES=QUERIES;
