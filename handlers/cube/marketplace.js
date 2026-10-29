'use strict';

const QUERY = [
  "SELECT l.id::text AS id, l.silo_id, l.sku, l.slug, l.title,",
  "l.description, l.category, l.listing_type, l.price_minor,",
  "l.currency, l.quantity, l.published_at",
  "FROM marketplace.listings l",
  "JOIN marketplace.silo_contracts sc ON sc.silo_id=l.silo_id",
  "JOIN marketplace.supply_attestations sa ON sa.listing_id=l.id AND sa.silo_id=l.silo_id",
  "WHERE l.status = 'published' AND l.quantity > 0",
  "AND sc.status = 'active' AND sc.publication_approved_at IS NOT NULL",
  "AND sc.legal_review_approved_at IS NOT NULL",
  "AND sc.currency = upper(l.currency)",
  "AND sa.status = 'verified' AND sa.verified_quantity >= l.quantity",
  "AND sa.verified_at IS NOT NULL AND sa.expires_at > now()",
  "AND sa.evidence_sha256 IS NOT NULL",
  "AND ($1::text IS NULL OR l.silo_id = $1)",
  "ORDER BY l.published_at DESC NULLS LAST, l.id DESC",
  "LIMIT $2::integer OFFSET $3::integer"
].join(' ');
function respond(res,status,data){
  res.statusCode=status;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','public, max-age=0, s-maxage=30');
  res.setHeader('x-content-type-options','nosniff');
  res.end(JSON.stringify(data));
}
function readInteger(value,fallback,maximum){
  if(value===null||value==='')return fallback;
  if(!/^(0|[1-9][0-9]*)$/.test(String(value)))return null;
  const n=Number(value);
  return Number.isSafeInteger(n)&&n<=maximum?n:null;
}
function safePublic(row){
  const price=Number(row.price_minor);
  const quantity=Number(row.quantity);
  if(!Number.isSafeInteger(price)||price<0||!Number.isInteger(quantity)||quantity<=0)
    throw Error('INVALID_PUBLIC_LISTING');
  return {
    id:String(row.id),silo_id:String(row.silo_id),sku:String(row.sku),
    slug:String(row.slug),title:String(row.title),
    description:String(row.description||''),category:String(row.category),
    listing_type:String(row.listing_type),price_minor:price,
    currency:String(row.currency),quantity,status:'published'
  };
}
function createHandler(deps={}){
 const getEnv=deps.getEnv||(()=>process.env.NEON_DATABASE_URL);
 const getQuery=deps.getQuery||(()=>{
  const neon=require('@neondatabase/serverless').neon(getEnv());
  return (statement,params)=>neon.query(statement,params);
 });
 return async function(req,res){
  if(req.method!=='GET')return respond(res,405,{error:'METHOD_NOT_ALLOWED'});
  let url;
  try{url=new URL(String(req.url||'/'),'https://dreamledger.org');}
  catch{return respond(res,400,{error:'INVALID_REQUEST'});}
  const p=url.searchParams;
  if([...p.keys()].some(k=>!['silo','limit','offset'].includes(k)))
   return respond(res,400,{error:'UNKNOWN_QUERY_PARAMETER'});
  const silo=p.get('silo');
  if(silo!==null&&!/^[a-z0-9-]{2,48}$/.test(silo))
   return respond(res,400,{error:'INVALID_SILO'});
  const limit=readInteger(p.get('limit'),20,100);
  const offset=readInteger(p.get('offset'),0,5000);
  if(limit===null||limit<1||offset===null)
   return respond(res,400,{error:'INVALID_PAGINATION'});
  if(!getEnv())return respond(res,503,{error:'NEON_DATABASE_NOT_CONFIGURED',configured:false});
  try{
   const rows=await getQuery()(QUERY,[silo,limit,offset]);
   if(!Array.isArray(rows))throw Error('INVALID_DATABASE_REPLY');
   const items=rows.map(safePublic);
   return respond(res,200,{schema:'CUBE/B2B-MARKETPLACE/v2',source:'neon',
    items,count:items.length,next_offset:items.length===limit&&offset+limit<=5000?offset+limit:null,
    independent_revenue_evidence:false});
  }catch{return respond(res,503,{error:'MARKETPLACE_DATA_UNAVAILABLE'});}
 };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
module.exports.QUERY=QUERY;
