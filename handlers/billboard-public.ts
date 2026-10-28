// Public web-canvas placement reader. No DOOH screen inventory, buyer PII or
// unapproved submissions are exposed here. Exact geometry is never invented.
const PROJECT_URL = 'https://wbwgroygjeyukkspnqiy.supabase.co';
const MARKETS = new Set(['GLOBAL','NZ','AU','ZA','AMERICAS','EUROPE']);
function reply(status:number,value:any) {
 return new Response(JSON.stringify(value),{status,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff'
 }});
}
function safeLink(value:unknown) {
 try {const u=new URL(String(value||''));return u.protocol==='https:'?u.href:null;}
 catch {return null;}
}
function validGeometry(v:any) {
 const x=Number(v.x),y=Number(v.y),w=Number(v.width),h=Number(v.height);
 // No coordinate fallback. Position only if provided by the approved view.
 if ([v.x,v.y,v.width,v.height].some(n=>n===null||n===undefined||n===''))return null;
 if (![x,y,w,h].every(Number.isInteger)||x<0||y<0||w<100||h<100||
     x%100||y%100||w%100||h%100||x+w>1000||y+h>1000)return null;
 return {x,y,width:w,height:h,cell_index:y/100*10+x/100};
}
function marketOf(raw:unknown) {
 const m=String(raw||'').trim().toUpperCase();
 return MARKETS.has(m)?m:'UNSPECIFIED';
}
export default async function handler(request:Request) {
 if(request.method!=='GET')return reply(405,{error:'METHOD_NOT_ALLOWED'});
 const base=String(process.env.SUPABASE_URL||PROJECT_URL).replace(/[/]$/,'');
 // Publishable key only: access to billboard_public must remain RLS-limited.
 const key=process.env.SUPABASE_PUBLISHABLE_KEY||
   'sb_publishable_O5JRD67KaU3SA9dFq-JIuQ_Pzs8pedj';
 if(!key)return reply(503,{error:'BILLBOARD_PUBLIC_DATA_NOT_CONFIGURED'});
 try{
  const upstream=await fetch(base+'/rest/v1/billboard_public?select=*&limit=1000',{
   headers:{apikey:key,authorization:'Bearer '+key,accept:'application/json'},
   cache:'no-store',signal:AbortSignal.timeout(9000)
  });
  if(!upstream.ok)return reply(503,{error:'BILLBOARD_PUBLIC_DATA_UNAVAILABLE'});
  const records=await upstream.json();
  if(!Array.isArray(records))return reply(502,{error:'BILLBOARD_PUBLIC_DATA_INVALID'});
  const items=records.filter((v:any)=>v && typeof v==='object' &&
    (String(v.status||'').toUpperCase()==='PUBLISHED'||
      (!('status' in v)&&Boolean(v.published_at))))
    .map((v:any)=>{
      const g=validGeometry(v);
      return {
       id:String(v.campaign_id||v.id||'').slice(0,80),
       title:String(v.title||v.label||v.billboard_label||'Published placement').slice(0,80),
       market:marketOf(v.market),
       geometry:g,
       cell_index:g&&g.width===100&&g.height===100?g.cell_index:null,
       destination_url:safeLink(v.destination_url||v.link),
       image_url:safeLink(v.image_url),
       status:'PUBLISHED'
      };
    });
  return reply(200,{schema:'dreamledger/web-billboard-public/v2',source:'billboard_public',
    count:items.length,items,verified_external_revenue_claim:false,
    physical_screen_inventory_verified:false});
 }catch{return reply(503,{error:'BILLBOARD_PUBLIC_DATA_UNAVAILABLE'});}
}
