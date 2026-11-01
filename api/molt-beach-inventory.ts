// BECK verified inventory Vercel Function. STAGED, NOT DEPLOYED.
// Public, read-only, and strictly fail-closed; no PII or service credentials returned.
export default async function handler(request: Request): Promise<Response> {
  const headers = {'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store'};
  const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
  if(request.method!=='GET')return respond(405,{error:'method_not_allowed'});
  const url=new URL(request.url);
  if(url.searchParams.get('market')!=='NZ')
    return respond(503,{error:'inventory_not_verified_for_market'});
  try {
    const backend=await import('../BEC-PRIME/runtime/BeckAdInventoryRead.js');
    const fn=backend.inventory||backend.default?.inventory;
    if(typeof fn!=='function')return respond(503,{error:'inventory_backend_unavailable'});
    const snapshot=await fn();
    if(snapshot?.inventory_source!=='verified_registered_supabase'||
       snapshot?.market!=='NZ'||!Number.isInteger(snapshot?.remaining_founding_units))
      return respond(503,{error:'inventory_not_verified'});
    return respond(200,snapshot);
  }catch{
    return respond(503,{error:'verified_ad_inventory_unavailable'});
  }
}
