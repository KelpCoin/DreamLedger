'use strict';
// Public gallery reads only a reviewed immutable Git-backed manifest, not a failed
// payment system/database and never exposes buyer records. Missing or bad source
// fails closed. A purchase alone NEVER authorizes public placement.
const manifest=require('../public/data/billboard-published.json');
function reply(status,value) {
  return new Response(JSON.stringify(value),{
    status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}
  });
}
function httpsOnly(v) {
  if(!v) return null;
  try { const u=new URL(String(v));return u.protocol==='https:'?u.href:null; }
  catch { return null; }
}
async function handler(request) {
  if(request.method!=='GET')return reply(405,{error:'METHOD_NOT_ALLOWED'});
  if(!manifest || manifest.schema!=='dreamledger/billboard-approved-public/v1' || !Array.isArray(manifest.items))
    return reply(503,{error:'BILLBOARD_PUBLIC_MANIFEST_INVALID'});
  const items=[];
  const seen=new Set();
  for(const v of manifest.items) {
    if(!v || typeof v!=='object')return reply(503,{error:'BILLBOARD_PUBLIC_ENTRY_INVALID'});
    // Explicit evidence check before publication. Never accept a draft or demo.
    if(v.status!=='PUBLISHED' || v.payment_verified!==true ||
       v.moderation_status!=='APPROVED' ||
       !/^\d{4}-\d\d-\d\dT/.test(String(v.published_at||'')) ||
       !/^[a-f0-9]{64}$/i.test(String(v.receipt_sha256||'')) ||
       !/^[a-zA-Z0-9_-]{4,80}$/.test(String(v.id||'')) ||
       !String(v.title||'').trim() || seen.has(v.id))
       return reply(503,{error:'BILLBOARD_PUBLIC_ENTRY_EVIDENCE_INVALID'});
    seen.add(v.id);
    items.push({
      id:v.id,title:String(v.title).slice(0,80),
      market:String(v.market||'NZ').slice(0,20),
      destination_url:httpsOnly(v.destination_url),image_url:httpsOnly(v.image_url),
      cell_index:Number.isInteger(v.cell_index)&&v.cell_index>=0&&v.cell_index<100?v.cell_index:
        (Number.isInteger(v.x)&&Number.isInteger(v.y)&&v.x>=0&&v.y>=0&&v.x<=900&&v.y<=900&&v.x%100===0&&v.y%100===0
          &&Number(v.width||100)===100&&Number(v.height||100)===100
          ?(v.y/100)*10+v.x/100:null),
      status:'PUBLISHED'
    });
  }
  return reply(200,{source:'git_approved_billboard_ledger',count:items.length,items,
    verified_external_revenue_claim:false,publication_evidence_required:true});
}
module.exports=handler;
