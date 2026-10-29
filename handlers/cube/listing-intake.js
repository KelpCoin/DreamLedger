'use strict';
const {createHash}=require('node:crypto');
const signedSession=require('../../BEC-PRIME/compiled/website/lib/signedSession');
const QUERY=[
 "INSERT INTO marketplace.silo_listing_intake",
 "(silo_id,submitter_principal_id,idempotency_key,payload_sha256,listing_kind,",
 "title,description,price_minor,currency,quantity,fulfillment_mode,attributes,photo_urls)",
 "SELECT sc.silo_id,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb",
 "FROM marketplace.silo_contracts sc",
 "WHERE sc.silo_id=$1 AND sc.status='active' AND sc.currency=$9",
 "AND sc.publication_approved_at IS NOT NULL AND sc.legal_review_approved_at IS NOT NULL",
 "AND (SELECT count(*) FROM marketplace.silo_listing_intake q",
 "WHERE q.silo_id=$1 AND q.submitter_principal_id=$2",
 "AND q.created_at > now()-interval '24 hours') < 20",
 "ON CONFLICT (silo_id,submitter_principal_id,idempotency_key) DO NOTHING",
 "RETURNING id::text AS id,status"
].join(' ');
function reply(res,status,body){
 res.statusCode=status;
 res.setHeader('content-type','application/json; charset=utf-8');
 res.setHeader('cache-control','private, no-store');
 res.setHeader('x-content-type-options','nosniff');
 res.end(JSON.stringify(body));
}
function parse(body) {
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('INVALID_PAYLOAD');
 const allowed=new Set(['silo','idempotency_key','listing_kind','title','description',
  'price_minor','currency','quantity','fulfillment_mode','attributes','photo_urls']);
 if(Object.keys(body).some(k=>!allowed.has(k)))throw Error('UNKNOWN_INPUT_FIELD');
 const {silo,idempotency_key,listing_kind,title,description,price_minor,currency,quantity,fulfillment_mode}=body;
 if(typeof silo!=='string'||!/^[a-z0-9-]{2,48}$/.test(silo)||
  typeof idempotency_key!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(idempotency_key)||
  !['physical','digital','service'].includes(listing_kind)||
  typeof title!=='string'||title.trim().length<3||title.length>180||
  typeof description!=='string'||description.trim().length<1||description.length>5000||
  !Number.isSafeInteger(price_minor)||price_minor<0||price_minor>100000000000||
  typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency)||
  !Number.isInteger(quantity)||quantity<1||quantity>10000||
  !['shipping','pickup','digital','service'].includes(fulfillment_mode))
    throw Error('INVALID_LISTING');
 const attributes=body.attributes==null?{}:body.attributes;
 if(!attributes||typeof attributes!=='object'||Array.isArray(attributes)||Object.keys(attributes).length>40)
   throw Error('INVALID_ATTRIBUTES');
 for(const [key,value] of Object.entries(attributes)){
  if(!/^[a-z][a-z0-9_]{1,47}$/.test(key)||
    !['string','number','boolean'].includes(typeof value)||
    (typeof value==='string'&&value.length>500)||
    (typeof value==='number'&&!Number.isFinite(value)))
    throw Error('INVALID_ATTRIBUTES');
 }
 const photos=body.photo_urls==null?[]:body.photo_urls;
 if(!Array.isArray(photos)||photos.length>8||photos.some(x=>
   typeof x!=='string'||x.length>500||!/^https:\/\//i.test(x)))
   throw Error('INVALID_PHOTOS');
 const normalized={silo,listing_kind,title:title.trim(),
  description:description.trim(),price_minor,currency,quantity,
  fulfillment_mode,attributes,photo_urls:photos};
 const digest=createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
 return {normalized,idempotency_key,digest};
}
function createHandler(deps={}){
 const env=deps.env||(()=>process.env);
 const dbFactory=deps.db||((connection)=>{
  const neon=require('@neondatabase/serverless').neon(connection);
  return (sql,args)=>neon.query(sql,args);
 });
 return async function(req,res){
  if(req.method!=='POST')return reply(res,405,{error:'METHOD_NOT_ALLOWED'});
  if(!String(req.headers?.['content-type']||'').toLowerCase().startsWith('application/json'))
   return reply(res,415,{error:'JSON_REQUIRED'});
  const cfg=env();
  if(!cfg.NEON_DATABASE_URL||!cfg.DREAMLEDGER_SESSION_SECRET||
    Buffer.byteLength(cfg.DREAMLEDGER_SESSION_SECRET,'utf8')<32)
    return reply(res,503,{error:'LISTING_INTAKE_UNAVAILABLE'});
  const principal=signedSession.fromCookie(req.headers.cookie,cfg.DREAMLEDGER_SESSION_SECRET);
  if(!principal)return reply(res,401,{error:'LOGIN_REQUIRED'});
  let parsed;
  try{parsed=parse(req.body);}catch{return reply(res,400,{error:'INVALID_LISTING'});}
  const x=parsed.normalized;
  const args=[x.silo,principal,parsed.idempotency_key,parsed.digest,x.listing_kind,
   x.title,x.description,x.price_minor,x.currency,x.quantity,x.fulfillment_mode,
   JSON.stringify(x.attributes),JSON.stringify(x.photo_urls)];
  try {
    const rows=await dbFactory(cfg.NEON_DATABASE_URL)(QUERY,args);
    if(!Array.isArray(rows))throw Error('DATABASE_RESPONSE_INVALID');
    if(rows.length!==1)return reply(res,409,{error:'NOT_ACCEPTED_OR_DUPLICATE'});
    return reply(res,202,{schema:'CUBE/LISTING-INTAKE/v1',silo:x.silo,
      intake_id:String(rows[0].id),status:'pending',
      available_for_sale:false,publication_authorized:false});
  }catch{return reply(res,503,{error:'LISTING_INTAKE_UNAVAILABLE'});}
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
module.exports.parse=parse;module.exports.QUERY=QUERY;
