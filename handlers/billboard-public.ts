// Read-only public billboard gallery. Never exposes buyer or payment data.
// Only published placements are eligible; absent evidence produces an error, not a fake tile.
const PROJECT_URL = 'https://wbwgroygjeyukkspnqiy.supabase.co';
function reply(status:number, value:any) {
  return new Response(JSON.stringify(value), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
function safeLink(value:unknown) {
  try { const u = new URL(String(value||'')); return u.protocol === 'https:' ? u.href : null; }
  catch { return null; }
}
export default async function handler(request:Request) {
  if (request.method !== 'GET') return reply(405,{error:'METHOD_NOT_ALLOWED'});
  const base=String(process.env.SUPABASE_URL||PROJECT_URL).replace(/\/$/,'');
  // This key is intentionally publishable, scoped to the public project's RLS permissions.
  const key=process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_O5JRD67KaU3SA9dFq-JIuQ_Pzs8pedj';
  if(!key) return reply(503,{error:'BILLBOARD_PUBLIC_DATA_NOT_CONFIGURED'});
  try {
    const upstream=await fetch(base+'/rest/v1/billboard_public?select=*&limit=100',{
      headers:{apikey:key,authorization:'Bearer '+key,accept:'application/json'},
      cache:'no-store',signal:AbortSignal.timeout(9000)
    });
    if(!upstream.ok) return reply(503,{error:'BILLBOARD_PUBLIC_DATA_UNAVAILABLE'});
    const records=await upstream.json();
    if(!Array.isArray(records)) return reply(502,{error:'BILLBOARD_PUBLIC_DATA_INVALID'});
    const items=records
      .filter((v:any)=>v && typeof v==='object' &&
          (String(v.status||'').toUpperCase()==='PUBLISHED' || (!('status' in v) && Boolean(v.published_at))))
      .map((v:any)=>({
        id:String(v.campaign_id||v.id||'').slice(0,80),
        title:String(v.title||v.label||v.billboard_label||'Published placement').slice(0,80),
        market:String(v.market||'NZ').slice(0,20),
        destination_url:safeLink(v.destination_url||v.link),
        image_url:safeLink(v.image_url),
        status:'PUBLISHED'
      }));
    return reply(200,{source:'billboard_public',count:items.length,items,verified_external_revenue_claim:false});
  } catch {
    return reply(503,{error:'BILLBOARD_PUBLIC_DATA_UNAVAILABLE'});
  }
}
