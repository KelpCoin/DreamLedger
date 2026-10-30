'use strict';
// Existing Vercel dispatcher exposes this private Agent Bridge capability.
// Art goes to Neon only. NO Supabase, public publishing, checkout or entitlements.
const crypto=require('node:crypto');
const {authorize,verifyOrigin,draftFromBody,sha256}=require('./cosmetic-policy');

function json(body,status=200) {
  return new Response(JSON.stringify(body),{status,headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'private, no-store',
    'x-content-type-options':'nosniff',
    'content-security-policy':"default-src 'none'",
  }});
}
function config() {
  const url=process.env.BECK_NEON_CREATOR_DATABASE_URL||'';
  let parsed;
  try {parsed=new URL(url);}catch{return null;}
  if (!['postgresql:','postgres:'].includes(parsed.protocol)
    || !parsed.hostname.endsWith('.neon.tech')
    || !['require','verify-full'].includes(parsed.searchParams.get('sslmode'))) return null;
  return url;
}
function requireDraftId(value) {
  const id=String(value||'');
  if(!/^ASSET-(PEGGY|BIGGIE)-[A-F0-9]{20}$/.test(id))throw Object.assign(new Error('INVALID_DRAFT_ID'),{status:400});
  return id;
}
module.exports=async function creatorAgentBridge(request) {
  const trace=crypto.randomUUID();
  try {
    verifyOrigin(request.headers,process.env);
    // Each owner's credential is distinct from the other and from machine AgentBridge.
    const creator=authorize(request.headers,process.env);
    const dsn=config();
    if(!dsn)return json({error:'NEON_CREATOR_PRIMARY_NOT_CONFIGURED',trace_id:trace},503);
    const url=new URL(request.url),route=url.pathname;
    if(request.method!=='GET'&&request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
    const {neon}=await import('@neondatabase/serverless');
    const db=neon(dsn);
    if(route==='/api/agent-bridge/cosmetics/submit'&&request.method==='POST') {
      const text=await request.text();
      if(text.length>1800000)return json({error:'UPLOAD_TOO_LARGE',trace_id:trace},413);
      let input;
      try{input=JSON.parse(text);}catch{return json({error:'INVALID_JSON',trace_id:trace},400);}
      const item=draftFromBody(input,creator);
      const rows=await db.query('SELECT public.beck_creator_submit_draft_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) AS result',[
        item.draftId,creator,item.title,item.slot,item.artist,item.file,item.notes,item.mime,
        item.hash,item.metaHash,item.base64,item.originKind,item.parentDraftId]);
      const outcome=rows[0]?.result;
      if(!outcome?.draft_id)return json({error:'CREATOR_DB_RECEIPT_MISSING',trace_id:trace},503);
      const {gauntlet:privateVerdict,...publicReceipt}=outcome;
      return json({...publicReceipt,review_status:privateVerdict,
        trace_id:trace,silo_id:'SILO_AVATAR',
        render_targets:['dreamiez','kelp-atlantis'],checkout_available:false,publicly_visible:false,
        message:'Private source artwork retained for an approval-gated enhancement and wearable-fit workflow; no AI processing or publication is implied.'},
        outcome.idempotent?200:201);
    }
    if(route==='/api/agent-bridge/cosmetics/mine'&&request.method==='GET') {
      const rows=await db.query('SELECT draft_id,title,wearable_slot,media_type,source_sha256,origin_kind,parent_draft_id,created_at,lifecycle,gauntlet_verdict,approval_required,checkout_available FROM public.beck_creator_cosmetic_drafts WHERE creator_id=$1 ORDER BY created_at DESC LIMIT 50',[creator]);
      const privateItems=rows.map(({gauntlet_verdict,...record})=>({...record,review_status:gauntlet_verdict}));
      return json({creator_id:creator,private:true,count:privateItems.length,items:privateItems,trace_id:trace});
    }
    if(route==='/api/agent-bridge/cosmetics/image'&&request.method==='GET') {
      const id=requireDraftId(url.searchParams.get('id'));
      const rows=await db.query("SELECT media_type,encode(source_bytes,'base64') AS encoded FROM public.beck_creator_cosmetic_drafts WHERE creator_id=$1 AND draft_id=$2 LIMIT 1",[creator,id]);
      if(!rows.length)return json({error:'PRIVATE_DRAFT_NOT_FOUND',trace_id:trace},404);
      const bytes=Buffer.from(rows[0].encoded,'base64');
      return new Response(bytes,{status:200,headers:{
        'content-type':rows[0].media_type,'cache-control':'private, no-store',
        'x-content-type-options':'nosniff','content-security-policy':"default-src 'none'",
        'x-beck-artwork-sha256':sha256(bytes),
      }});
    }
    return json({error:'CREATOR_BRIDGE_ROUTE_NOT_FOUND',trace_id:trace},404);
  } catch(e) {
    const status=Number(e?.status)||503;
    if(status>=500)console.error('CREATOR_AGENT_BRIDGE_HOLD',trace,'DATABASE_OR_ADAPTER_UNAVAILABLE');
    return json({error:status<500?String(e?.message||'CREATOR_POLICY_REFUSED'):
      'NEON_CREATOR_INTAKE_HOLD',trace_id:trace},status<500?status:503);
  }
};
