'use strict';
const QUERY=[
 "SELECT c.id::text AS id,c.kind,c.title,c.body,c.public_alias,c.published_at",
 "FROM marketplace.community_posts c",
 "JOIN marketplace.silo_contracts s ON s.silo_id=c.silo_id",
 "WHERE c.silo_id=$1 AND s.status='active'",
 "AND s.publication_approved_at IS NOT NULL AND s.legal_review_approved_at IS NOT NULL",
 "AND c.status='published' AND c.moderation_receipt_sha256 ~ '^[a-f0-9]{64}$'",
 "AND c.moderated_at IS NOT NULL AND c.published_at IS NOT NULL",
 "ORDER BY c.published_at DESC,c.id DESC LIMIT $2::integer"
].join(' ');
function response(res,code,body) {
 res.statusCode=code;
 res.setHeader('content-type','application/json; charset=utf-8');
 res.setHeader('cache-control','public, max-age=0, s-maxage=30');
 res.setHeader('x-content-type-options','nosniff');
 res.end(JSON.stringify(body));
}
function createHandler(deps={}) {
 const env=deps.env||(()=>process.env.NEON_DATABASE_URL);
 const query=deps.query||((url)=>{
  const neon=require('@neondatabase/serverless').neon(url);
  return (sql,args)=>neon.query(sql,args);
 });
 return async function(req,res){
  if(req.method!=='GET')return response(res,405,{error:'METHOD_NOT_ALLOWED'});
  let p;
  try{p=new URL(String(req.url||'/'),'https://dreamledger.org').searchParams;}
  catch{return response(res,400,{error:'INVALID_REQUEST'});}
  if(p.size!==1||!p.has('silo'))return response(res,400,{error:'SILO_REQUIRED'});
  const silo=p.get('silo');
  if(!/^[a-z0-9-]{2,48}$/.test(silo))return response(res,400,{error:'INVALID_SILO'});
  if(!env())return response(res,503,{error:'COMMUNITY_UNAVAILABLE'});
  try {
   const rows=await query(env())(QUERY,[silo,30]);
   if(!Array.isArray(rows))throw Error('INVALID_DB_REPLY');
   const items=rows.map(r=>({
    id:String(r.id),kind:String(r.kind),title:String(r.title).slice(0,180),
    body:String(r.body).slice(0,5000),
    public_alias:r.public_alias?String(r.public_alias).slice(0,60):null,
    published_at:r.published_at
   }));
   return response(res,200,{schema:'CUBE/COMMUNITY/v1',silo,items,
     count:items.length,source:'moderated_first_party_only',
     activity_estimate_inferred:false});
  }catch{return response(res,503,{error:'COMMUNITY_UNAVAILABLE'});}
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;module.exports.QUERY=QUERY;
