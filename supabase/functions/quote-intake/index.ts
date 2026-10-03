import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@22";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const STRIPE_API_KEY=Deno.env.get("STRIPE_API_KEY")||Deno.env.get("STRIPE_SECRET_KEY")||"";
const db=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const stripe=new Stripe(STRIPE_API_KEY);
const BUCKET="marketplace-fulfillment";
const PAYMENT_LINK="plink_1UKq77EGgEAnUFF9KOr1SuUY";
const SKU="QUOTE-COMPARE-49";
const MAX_FILES=5;
const MAX_BYTES=10*1024*1024;
const MAX_UPLOAD_INITS=5;
const MAX_FINALIZE_ATTEMPTS=3;
const cors={"Access-Control-Allow-Origin":"https://dreamledger.org","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store",...cors}});
function safeName(name:string){const cleaned=name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g,"_").replace(/^\.+/,"").slice(0,140);return cleaned||"quote";}
async function sessionContext(sessionId:string){
  if(!sessionId||!/^cs_[A-Za-z0-9_]+$/.test(sessionId))throw new Error("INVALID_SESSION_ID");
  const session=await stripe.checkout.sessions.retrieve(sessionId);
  if(session.livemode!==true||session.payment_status!=="paid")throw new Error("PAYMENT_NOT_SETTLED");
  if(session.payment_link!==PAYMENT_LINK)throw new Error("WRONG_PAYMENT_LINK");
  if(session.metadata?.sku_id!==SKU&&session.metadata?.dreamledger_sku!==SKU)throw new Error("WRONG_SKU");
  const {data:order}=await db.from("revenue_orders").select("id,sku_id,amount_nzd,currency,customer_email").eq("stripe_checkout_session_id",session.id).eq("sku_id",SKU).maybeSingle();
  if(!order)throw new Error("SETTLEMENT_RECORD_PENDING");
  const {data:ent}=await db.from("revenue_entitlements").select("id").eq("order_id",order.id).maybeSingle();
  if(!ent)throw new Error("ENTITLEMENT_PENDING");
  const {data:fr}=await db.from("fulfillment_requests").select("id,entitlement_id,status,canonical_state,fulfillment_reference,evidence_reference,evidence_status,payload").eq("entitlement_id",ent.id).maybeSingle();
  if(!fr)throw new Error("FULFILLMENT_REQUEST_NOT_FOUND");
  return {session,order,fulfillment:fr};
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{status:204,headers:cors});
  if(req.method!=="POST")return out({error:"POST_REQUIRED"},405);
  if(!SUPABASE_URL||!SERVICE_ROLE_KEY||!STRIPE_API_KEY)return out({error:"SERVICE_NOT_CONFIGURED"},503);
  const body=await req.json().catch(()=>({}));const action=String(body.action||"initialize");const sessionId=String(body.session_id||"");
  try{
    const ctx=await sessionContext(sessionId);const fr=ctx.fulfillment;
    if(action==="initialize"){
      if(fr.status==="fulfilled")return out({error:"ALREADY_FULFILLED",fulfillment_request_id:fr.id},409);
      const pl=(fr.payload&&typeof fr.payload==="object")?fr.payload:{};
      const inits=Number((pl as any).upload_inits||0);
      if(inits>=MAX_UPLOAD_INITS)return out({error:"UPLOAD_LIMIT_REACHED"},429);
      const supplied=Array.isArray(body.files)?body.files.slice(0,MAX_FILES):[];
      if(supplied.length<2||supplied.length>MAX_FILES)return out({error:"QUOTE_COUNT_MUST_BE_2_TO_5"},400);
      const uploads=[];
      for(let i=0;i<supplied.length;i++){
        const original=safeName(String(supplied[i]?.name||`quote-${i+1}.pdf`));
        const path=`quote-inputs/${ctx.order.id}/${crypto.randomUUID()}-${original}`;
        const {data,error}=await db.storage.from(BUCKET).createSignedUploadUrl(path,{upsert:false});
        if(error||!data)return out({error:"SIGNED_UPLOAD_URL_FAILED"},500);
        uploads.push({path,token:data.token,name:original});
      }
      const {error:ie}=await db.from("fulfillment_requests").update({payload:{...pl,upload_inits:inits+1}}).eq("id",fr.id);
      if(ie)return out({error:"FULFILLMENT_UPDATE_FAILED"},500);
      return out({ok:true,action,fulfillment_request_id:fr.id,order_id:ctx.order.id,uploads});
    }
    if(action==="finalize"){
      if(fr.status==="fulfilled")return out({error:"ALREADY_FULFILLED",fulfillment_request_id:fr.id},409);
      const pl=(fr.payload&&typeof fr.payload==="object")?fr.payload:{};
      const attempts=Number((pl as any).finalize_attempts||0);
      if(attempts>=MAX_FINALIZE_ATTEMPTS)return out({error:"ATTEMPT_LIMIT_REACHED"},429);
      const files=Array.isArray(body.files)?body.files.slice(0,MAX_FILES):[];if(files.length<2||files.length>MAX_FILES)return out({error:"QUOTE_COUNT_MUST_BE_2_TO_5"},400);
      const requirements=String(body.requirements||"").trim().slice(0,12000);if(!requirements)return out({error:"REQUIREMENTS_REQUIRED"},400);
      const inputFiles=[];
      for(const file of files){
        const p=String(file.path||"");const name=safeName(String(file.name||p.split("/").pop()||"quote"));const size=Number(file.size||0);
        if(!p.startsWith(`quote-inputs/${ctx.order.id}/`)||p.includes(".."))return out({error:"INVALID_STORAGE_PATH"},400);
        if(size<=0||size>MAX_BYTES)return out({error:"FILE_SIZE_INVALID",file:name},400);
        const ext=name.toLowerCase().split(".").pop()||"";if(!["pdf","csv","json","md"].includes(ext))return out({error:"UNSUPPORTED_FILE_TYPE",file:name},400);
        const dir=`quote-inputs/${ctx.order.id}`;const listed=await db.storage.from(BUCKET).list(dir,{limit:100});
        if(!listed.data?.some(x=>p.endsWith("/"+x.name)))return out({error:"UPLOADED_FILE_NOT_FOUND",file:name},400);
        inputFiles.push({path:p,name,size,sha256:String(file.sha256||"")||null});
      }
      const payload={...pl,source:"quote_intake",requirements,input_files:inputFiles,finalized_at:new Date().toISOString(),finalize_attempts:attempts+1};
      const {error:updateError}=await db.from("fulfillment_requests").update({payload,status:"queued",canonical_state:"INPUTS_READY",evidence_status:"UNVERIFIED"}).eq("id",fr.id);
      if(updateError)return out({error:"FULFILLMENT_UPDATE_FAILED"},500);
      const workerUrl=SUPABASE_URL+"/functions/v1/quote-fulfillment";
      const worker=await fetch(workerUrl,{method:"POST",headers:{Authorization:"Bearer "+SERVICE_ROLE_KEY,apikey:SERVICE_ROLE_KEY,"Content-Type":"application/json"},body:JSON.stringify({fulfillment_request_id:fr.id})});
      const wt=await worker.text();let wd:any;try{wd=JSON.parse(wt)}catch{wd={raw:wt}};
      if(!worker.ok||wd?.ok===false)return out({error:"FULFILLMENT_WORKER_FAILED",fulfillment_request_id:fr.id,worker:wd,status:"queued",attempts_remaining:MAX_FINALIZE_ATTEMPTS-(attempts+1)},502);
      return out({ok:true,action,fulfillment_request_id:fr.id,status:wd.status||"fulfilled",fulfillment_reference:wd.fulfillment_reference||null,evidence_reference:wd.evidence_reference||null});
    }
    if(action==="status"){
      let download_url=null;
      if(fr.status==="fulfilled"&&fr.fulfillment_reference){const {data}=await db.storage.from(BUCKET).createSignedUrl(fr.fulfillment_reference,3600);download_url=data?.signedUrl||null;}
      return out({ok:true,status:fr.status,canonical_state:fr.canonical_state,evidence_status:fr.evidence_status,fulfillment_reference:fr.fulfillment_reference,evidence_reference:fr.evidence_reference,download_url});
    }
    return out({error:"UNKNOWN_ACTION"},400);
  }catch(e){const code=e instanceof Error?e.message:"UNKNOWN";const status=["PAYMENT_NOT_SETTLED","WRONG_PAYMENT_LINK","WRONG_SKU","SETTLEMENT_RECORD_PENDING","ENTITLEMENT_PENDING","FULFILLMENT_REQUEST_NOT_FOUND"].includes(code)?409:400;return out({error:code},status);}
});
