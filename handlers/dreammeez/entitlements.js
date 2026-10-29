'use strict';
const session = require('../../BEC-PRIME/compiled/website/lib/signedSession');
const QUERY = [
 "SELECT item_id FROM public.dreammeez_entitlements",
 "WHERE account_id=$1 AND grant_status='active'",
 "ORDER BY item_id LIMIT 200"
].join(' ');
function json(res,status,data) {
 res.statusCode=status;
 res.setHeader('content-type','application/json; charset=utf-8');
 res.setHeader('cache-control','private, no-store');
 res.setHeader('x-content-type-options','nosniff');
 res.end(JSON.stringify(data));
}
// Dependency injection for offline testing; the actual production adapter
// never accepts a user_id, email or entitlement list from a client.
function createHandler(deps={}) {
 const env=deps.env||(()=>process.env);
 const run=deps.run||((conn,statement,args)=>{
   const client=require('@neondatabase/serverless').neon(conn);
   return client.query(statement,args);
 });
 return async function handler(req,res){
   if(req.method!=='GET')return json(res,405,{error:'METHOD_NOT_ALLOWED'});
   const cfg=env();
   if(!cfg.DREAMLEDGER_SESSION_SECRET || Buffer.byteLength(cfg.DREAMLEDGER_SESSION_SECRET)<32 ||
      !cfg.NEON_DATABASE_URL)return json(res,503,{error:'OWNERSHIP_SERVICE_UNAVAILABLE'});
   const account=session.fromCookie(req.headers?.cookie,cfg.DREAMLEDGER_SESSION_SECRET);
   if(!account)return json(res,401,{error:'LOGIN_REQUIRED',owned:[]});
   try {
     const rows=await run(cfg.NEON_DATABASE_URL,QUERY,[account]);
     if(!Array.isArray(rows))throw Error('INVALID_DATABASE_RESULT');
     const owned=rows.map(x=>x.item_id).filter(x=>typeof x==='string' && /^[a-z0-9-]{3,64}$/.test(x));
     return json(res,200,{schema:'dreammeez/entitlements/v1',authenticated:true,owned,
       verified_source:'server',game_entitlement_authority:'server_only'});
   } catch {
     return json(res,503,{error:'OWNERSHIP_SERVICE_UNAVAILABLE'});
   }
 };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
module.exports.QUERY=QUERY;
