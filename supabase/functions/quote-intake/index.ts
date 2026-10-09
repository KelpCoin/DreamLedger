import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@22";
import pdfParse from "npm:pdf-parse@1.1.1";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const STRIPE_API_KEY=Deno.env.get("STRIPE_API_KEY")||Deno.env.get("STRIPE_SECRET_KEY")||"";
const db=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const stripe=STRIPE_API_KEY?new Stripe(STRIPE_API_KEY):null;
const BUCKET="marketplace-fulfillment";
const PAYMENT_LINK="plink_1UKq77EGgEAnUFF9KOr1SuUY";
const SKU="QUOTE-COMPARE-49";
const MAX_FILES=5;
const MAX_BYTES=10*1024*1024;
const cors={"Access-Control-Allow-Origin":"https://dreamledger.org","Access-Control-Allow-Headers":"content-type, apikey, authorization","Access-Control-Allow-Methods":"POST,OPTIONS"};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store",...cors}});
const FREE_PREFIX="quote-inputs/free";
const cleanText=(s:string)=>s.replace(/\r/g,"").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim();
const extractField=(t:string,patterns:RegExp[])=>{for(const p of patterns){const m=t.match(p);if(m)return cleanText(m[1]);}return null;};
const extractMoney=(s:string)=>{const m=s.replace(/,/g,"").match(/(?:NZD|USD|AUD|CAD|EUR|GBP|\$|€|£)\s*(\d+(?:\.\d{1,2})?)/i);return m?Number(m[1]):null;};
const extractCurrency=(s:string)=>{const m=s.match(/(NZD|USD|AUD|CAD|EUR|GBP|\$|€|£)/i);if(!m)return null;const x=m[1].toUpperCase();return x==="$"?"AMBIGUOUS":x==="€"?"EUR":x==="£"?"GBP":x;};
function parseFreeQuote(name:string,text:string){const t=cleanText(text);const totalText=extractField(t,[/(?:grand total|total(?: price| amount| cost)?|quote total)\s*[:\-]?\s*((?:NZD|USD|AUD|CAD|EUR|GBP|\$|€|£)\s*[\d,]+(?:\.\d{1,2})?)/i]);return {file:name,currency:totalText?extractCurrency(totalText):null,total:totalText?extractMoney(totalText):null,moq:extractField(t,[/(?:MOQ|min(?:imum)? order quantity|min(?:imum)? order)\s*[:\-]?\s*([^\n]{1,80})/i]),lead_time:extractField(t,[/(?:lead time|delivery time|turnaround)\s*[:\-]?\s*([^\n]{1,100})/i]),payment_terms:extractField(t,[/(?:payment terms|terms of payment|payment)\s*[:\-]?\s*([^\n]{1,120})/i]),extraction_status:t?"PARSED":"EMPTY",text_length:t.length};}
async function hashValue(value:string){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,"0")).join("");}
function freeSummary(rows:any[]){const numeric=rows.filter(r=>typeof r.total==="number"&&r.currency&&r.currency!=="AMBIGUOUS");const currencies=[...new Set(numeric.map(r=>r.currency))];const comparable=currencies.length===1?numeric:[];const ordered=[...comparable].sort((a,b)=>a.total-b.total);const missing={total:rows.filter(r=>r.total===null).map(r=>r.file),currency:rows.filter(r=>!r.currency||r.currency==="AMBIGUOUS").map(r=>r.file),moq:rows.filter(r=>!r.moq).map(r=>r.file),lead_time:rows.filter(r=>!r.lead_time).map(r=>r.file),payment_terms:rows.filter(r=>!r.payment_terms).map(r=>r.file)};return {quote_count:rows.length,totals_observed:numeric.length,comparable_totals:comparable.length,currencies,lowest_total:ordered.length?ordered[0].total:null,highest_total:ordered.length?ordered[ordered.length-1].total:null,total_spread:ordered.length>=2?Number((ordered[ordered.length-1].total-ordered[0].total).toFixed(2)):null,missing_fields:missing,comparison_status:ordered.length>=2?"COMPLETE":numeric.length?"PARTIAL":"REVIEW_NEEDED",evidence_type:"QUOTED_OFFER",settled_transaction:false};}
async function freeIntake(body:any){
 const action=String(body.action||"");
 if(action==="free_initialize"){
  const supplied=Array.isArray(body.files)?body.files.slice(0,5):[];
  if(supplied.length<2||supplied.length>5)return out({error:"QUOTE_COUNT_MUST_BE_2_TO_5"},400);
  const files=[];
  const intakeId=crypto.randomUUID();
  for(let i=0;i<supplied.length;i++){
   const name=safeName(String(supplied[i]?.name||"quote-"+(i+1)+".pdf"));
   const ext=name.toLowerCase().split(".").pop()||"";
   if(!["pdf","csv","json","md"].includes(ext))return out({error:"UNSUPPORTED_FILE_TYPE",file:name},400);
   const path=FREE_PREFIX+"/"+intakeId+"/"+crypto.randomUUID()+"-"+name;
   const {data,error}=await db.storage.from(BUCKET).createSignedUploadUrl(path,{upsert:false});
   if(error||!data)return out({error:"SIGNED_UPLOAD_URL_FAILED"},503);
   files.push({path,token:data.token,name});
  }
  return out({ok:true,action:"free_initialize",intake_id:intakeId,uploads:files});
 }
 if(action==="free_finalize"){
  const intakeId=String(body.intake_id||"");
  if(!/^[0-9a-f-]{36}$/i.test(intakeId))return out({error:"INVALID_INTAKE_ID"},400);
  const requirements=String(body.requirements||"").trim().slice(0,12000);
  if(!requirements)return out({error:"REQUIREMENTS_REQUIRED"},400);
  const files=Array.isArray(body.files)?body.files.slice(0,5):[];
  if(files.length<2||files.length>5)return out({error:"QUOTE_COUNT_MUST_BE_2_TO_5"},400);
  const rows:any[]=[];const paths:string[]=files.map((f:any)=>String(f.path||"")).filter((p:string)=>p.startsWith(FREE_PREFIX+"/"+intakeId+"/")&&!p.includes(".."));let rawDeleted=false;
  try{
   for(const f of files){
    const path=String(f.path||"");const name=safeName(String(f.name||path.split("/").pop()||"quote"));
    if(!path.startsWith(FREE_PREFIX+"/"+intakeId+"/")||path.includes(".."))return out({error:"INVALID_STORAGE_PATH"},400);
    const size=Number(f.size||0);if(size<=0||size>MAX_BYTES)return out({error:"FILE_SIZE_INVALID",file:name},400);
    const ext=name.toLowerCase().split(".").pop()||"";if(!["pdf","csv","json","md"].includes(ext))return out({error:"UNSUPPORTED_FILE_TYPE",file:name},400);
    const listed=await db.storage.from(BUCKET).list(FREE_PREFIX+"/"+intakeId,{limit:100});
    if(!listed.data?.some(x=>path.endsWith("/"+x.name)))return out({error:"UPLOADED_FILE_NOT_FOUND",file:name},400);
    const {data:blob,error}=await db.storage.from(BUCKET).download(path);if(error||!blob)return out({error:"INPUT_DOWNLOAD_FAILED",file:name},502);
    if(blob.size>MAX_BYTES)return out({error:"FILE_TOO_LARGE",file:name},400);
    let extracted="";if(ext==="pdf"){const parsed=await pdfParse(new Uint8Array(await blob.arrayBuffer()));extracted=parsed.text||"";}else extracted=await blob.text();
    rows.push(parseFreeQuote(name,extracted));paths.push(path);
   }
   const comparison=freeSummary(rows);
   let oracle={status:"NOT_REQUESTED",reason:"Public sharing was not selected."};
   if(body.share_anonymized===true){
    const nums=rows.filter(r=>typeof r.total==="number"&&r.currency&&r.currency!=="AMBIGUOUS");
    const currencies=[...new Set(nums.map(r=>r.currency))];
    if(nums.length<3||currencies.length!==1)oracle={status:"NOT_PUBLISHED",reason:"Public observations require at least three numeric quotes in one unambiguous currency."};
    else{
     const totals=nums.map(r=>r.total).sort((a,b)=>a-b);const median=totals.length%2?totals[(totals.length-1)/2]:(totals[totals.length/2-1]+totals[totals.length/2])/2;
     const observedAt=new Date().toISOString();const evidenceHash=await hashValue(JSON.stringify({domain:"procurement",subject:"supplier_quote_total",currency:currencies[0],count:totals.length,min:totals[0],median,max:totals[totals.length-1],observedAt:observedAt.slice(0,10)}));
     const {error}=await db.from("truth_oracle_public_observations").upsert([{domain:"procurement",subject:"supplier_quote_total",item:"Anonymized aggregate supplier quote total range",value_numeric:median,unit:"quote_total_median",currency:currencies[0],source_name:"Opt-in anonymized quote comparison",source_url:"https://dreamledger.org/quote-comparison/",source_observed_at:observedAt,retrieved_at:observedAt,status:"OBSERVED",evidence_hash:evidenceHash,raw_ref:null,metadata:{evidence_type:"QUOTED_OFFER",settled_transaction:false,quote_count:totals.length,minimum_total:totals[0],median_total:median,maximum_total:totals[totals.length-1],spread:Number((totals[totals.length-1]-totals[0]).toFixed(2)),supplier_names_excluded:true,buyer_identity_excluded:true,source_documents_excluded:true}}],{onConflict:"evidence_hash",ignoreDuplicates:true});
     oracle=error?{status:"BLOCKED",reason:"Truth Oracle database write failed; comparison remains available."}:{status:"OBSERVATION_SUBMITTED",evidence_type:"QUOTED_OFFER",settled_transaction:false};
    }
   }
   const cleanup=paths.length?await db.storage.from(BUCKET).remove(paths):{error:null};rawDeleted=!cleanup.error;
   return out({ok:true,action:"free_finalize",intake_id:intakeId,requirements,comparison,quotes:rows,oracle_ingestion:oracle,privacy:{raw_documents_deleted_after_processing:rawDeleted,supplier_names_not_extracted_for_publication:true,public_observation_is_aggregate:true},notice:"Extracted quote evidence is not proof of a settled transaction or independently verified market price."});
  }catch(e){return out({error:"FREE_INTAKE_FAILED",detail:e instanceof Error?e.message:"UNKNOWN"},500);}
  finally{if(paths.length&&!rawDeleted)await db.storage.from(BUCKET).remove(paths);}
 }
 return null;
}
function safeName(name:string){const cleaned=name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g,"_").replace(/^\.+/,"").slice(0,140);return cleaned||"quote";}
async function sessionContext(sessionId:string){
  if(!stripe)throw new Error("SERVICE_NOT_CONFIGURED");
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
  const body=await req.json().catch(()=>({}));const action=String(body.action||"initialize");const sessionId=String(body.session_id||"");
  if(!SUPABASE_URL||!SERVICE_ROLE_KEY)return out({error:"SERVICE_NOT_CONFIGURED"},503);
  // Free quote comparison must not depend on Stripe being configured.
  if(action==="free_initialize"||action==="free_finalize"){
    const result=await freeIntake(body);return result||out({error:"UNKNOWN_ACTION"},400);
  }
  if(!STRIPE_API_KEY)return out({error:"SERVICE_NOT_CONFIGURED"},503);
  try{
    const ctx=await sessionContext(sessionId);const fr=ctx.fulfillment;
    if(action==="initialize"){
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
      return out({ok:true,action,fulfillment_request_id:fr.id,order_id:ctx.order.id,uploads});
    }
    if(action==="finalize"){
      if(fr.status==="fulfilled"||fr.canonical_state==="FULFILLED")return out({error:"ALREADY_FULFILLED",fulfillment_request_id:fr.id,status:"fulfilled",canonical_state:"FULFILLED"},409);
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
      const existingPayload=(fr.payload&&typeof fr.payload==="object")?fr.payload:{};
      const payload={...existingPayload,source:"quote_intake",requirements,input_files:inputFiles,finalized_at:new Date().toISOString()};
      const {error:updateError}=await db.from("fulfillment_requests").update({payload,status:"queued",canonical_state:"INPUTS_READY",evidence_status:"UNVERIFIED"}).eq("id",fr.id);
      if(updateError)return out({error:"FULFILLMENT_UPDATE_FAILED"},500);
      const workerUrl=SUPABASE_URL+"/functions/v1/quote-fulfillment";
      const worker=await fetch(workerUrl,{method:"POST",headers:{Authorization:"Bearer "+SERVICE_ROLE_KEY,apikey:SERVICE_ROLE_KEY,"Content-Type":"application/json"},body:JSON.stringify({fulfillment_request_id:fr.id})});
      const wt=await worker.text();let wd:any;try{wd=JSON.parse(wt)}catch{wd={raw:wt}};
      if(!worker.ok||wd?.ok===false)return out({error:"FULFILLMENT_WORKER_FAILED",fulfillment_request_id:fr.id,worker:wd,status:"queued"},502);
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
