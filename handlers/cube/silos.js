'use strict';
// CUBE silo registry: published config from Neon, never hardcoded domain names.
const QUERY = [
 "SELECT silo_id, display_name, currency, locale, inventory_mode,",
 "payment_provider, peer_fee_basis_points",
 "FROM marketplace.silo_contracts",
 "WHERE status = 'active' AND publication_approved_at IS NOT NULL",
 "AND legal_review_approved_at IS NOT NULL",
 "AND length(coalesce(legal_pack->>'policy_version','')) > 0",
 "ORDER BY silo_id LIMIT 500"
].join(' ');

function respond(res,status,data) {
 res.statusCode=status;
 res.setHeader('content-type','application/json; charset=utf-8');
 res.setHeader('cache-control','public, max-age=0, s-maxage=30');
 res.setHeader('x-content-type-options','nosniff');
 res.end(JSON.stringify(data));
}
function project(row) {
 const id=String(row.silo_id||'');
 if(!/^[a-z0-9-]{2,48}$/.test(id))throw Error('INVALID_SILO_ID');
 const fee=Number(row.peer_fee_basis_points);
 if(!Number.isInteger(fee)||fee<0||fee>10000)throw Error('INVALID_FEE');
 const currency=String(row.currency||'');
 if(!/^[A-Z]{3}$/.test(currency))throw Error('INVALID_CURRENCY');
 return {
   id,label:String(row.display_name||'').slice(0,120),
   route:'/'+id+'/',
   inventory_mode:String(row.inventory_mode||''),
   currency,locale:String(row.locale||''),
   payment_provider:String(row.payment_provider||'none'),
   peer_fee_basis_points:fee,
   publicly_approved:true
 };
}
function createHandler(deps={}) {
 const env=deps.env||(()=>process.env.NEON_DATABASE_URL);
 const query=deps.query||((connection)=>{
   const {neon}=require('@neondatabase/serverless');
   const db=neon(connection);
   return (statement,args)=>db.query(statement,args);
 });
 return async function(req,res) {
  if(req.method!=='GET')return respond(res,405,{error:'METHOD_NOT_ALLOWED'});
  if(!env())return respond(res,503,{error:'CUBE_REGISTRY_UNAVAILABLE'});
  try {
    const rows=await query(env())(QUERY,[]);
    if(!Array.isArray(rows))throw Error('INVALID_RESULT');
    return respond(res,200,{schema:'CUBE/SILO-REGISTRY/v2',
      silos:rows.map(project),count:rows.length,inventory_copied:false,
      production_activation_not_inferred:true});
  }catch {
    return respond(res,503,{error:'CUBE_REGISTRY_UNAVAILABLE'});
  }
 };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
module.exports.QUERY=QUERY;
