import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json"}});
async function sha(s:string){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,"0")).join("")}
function errorInfo(e:unknown){
 if(e && typeof e==="object"){
  const v=e as Record<string,unknown>, out:Record<string,string>={};
  for(const k of ["name","message","code","details","hint","status","statusCode"]){
   if(v[k]!==undefined && v[k]!==null)out[k]=String(v[k]).slice(0,600);
  }
  if(Object.keys(out).length)return out;
 }
 return {message:String(e).slice(0,600)};
}
async function auth(req:Request){
  const configuredHash="0ffd7cc415931d74fa53f3fe9d10a9f6b3800605ef60d0f9b5acb774daefc2e0";
  const dedicated=(req.headers.get("x-cube-heartbeat-secret")||"").trim();
  if(dedicated && (await sha(dedicated))===configuredHash) return true;
  // Backward compatibility for existing scheduled callers while they are migrated.
  const token=(req.headers.get("apikey")||req.headers.get("authorization")||"").replace(/^Bearer /,"");
  if(!token)return false;
  if((await sha(token))===await sha(key))return true;
  if((await sha(token))===configuredHash)return true;
  const {data}=await db.rpc("verify_economic_activation_token",{p_token:token});
  return data===true
}
function lines(s:string){return Math.max(0,(s.match(/\n/g)||[]).length)}
async function runCloudGauntlet(){try{const r=await fetch(url+"/functions/v1/cube-controller",{method:"POST",headers:{Authorization:"Bearer "+key,apikey:key,"Content-Type":"application/json"},body:JSON.stringify({run_reason:"scheduled_777_heartbeat"})});const t=await r.text();let body:any;try{body=JSON.parse(t)}catch{body={raw:t.slice(0,1200)}}return {status:r.status,ok:r.ok,body}}catch(e){return {status:"DEGRADED",ok:false,error:String(e)}}}
let lastControllerResult:any=null;
Deno.serve(async req=>{try{
 if(req.method==="GET" && new URL(req.url).pathname.endsWith("/healthz"))return out({status:"healthy",function:"economic-radar-heartbeat",version:27,revenue_claimed:false});
 if(req.method!=="POST")return out({error:"POST_REQUIRED"},405);
 if(!await auth(req))return out({error:"SERVICE_ROLE_REQUIRED"},403);
 let body:any={}; try{body=await req.json()}catch{}
 const manual777=body?.manual_777_ignition===true;
 if(manual777){
   const started=new Date().toISOString();
   const controller_result=lastControllerResult=await runCloudGauntlet();
   const {data:signals,error:se}=await db.from("economic_demand_signals").select("signal_id,source,status").eq("status","ROUTED").order("buyer_intent",{ascending:false}).limit(4);
   if(se) throw se;
   const ar=await fetch(url+"/functions/v1/economic-activation",{method:"POST",headers:{Authorization:"Bearer "+key,apikey:key,"Content-Type":"application/json"},body:JSON.stringify({manual_777_ignition:true})});
   const at=await ar.text();
   let activationBody:any={raw:at};
   try{activationBody=JSON.parse(at);}catch{}
   const activation={status:ar.status,body:activationBody};
   const rr=await db.from("cube_radar_runs").insert({started_at:started,finished_at:new Date().toISOString(),status:"MANUAL_777_IGNITION",feeds_seen:signals?.length||0,signals_ingested:0,signals_qualified:signals?.length||0,matches_created:0,tests_selected:0,external_actions:0,errors:ar.ok?0:1,degraded:!ar.ok,evidence:{manual_777_ignition:true,routed_signals:signals||[],activation,controller_result}});
   if(rr.error) throw rr.error;
   return out({ok:true,manual_777_ignition:true,skipped:false,reason:"MANUAL_777_IGNITION",routed_signals:signals||[],activation,controller_result,external_action_performed:false,revenue_claimed:false});
 }
 if(body?.heartbeat_only===true || (Array.isArray(body?.feeds)&&body.feeds.length===0)){
   const idempotencyKey=(req.headers.get("x-idempotency-key")||"").trim();
   if(!idempotencyKey)return out({error:"IDEMPOTENCY_KEY_REQUIRED",heartbeat_persisted:false},400);
   const prior=await db.from("cube_radar_runs").select("run_id,started_at,status,evidence").contains("evidence",{idempotency_key:idempotencyKey}).limit(1).maybeSingle();
   if(prior.error)throw prior.error;
   if(prior.data)return out({ok:true,status:"HEARTBEAT_ALREADY_RECORDED",heartbeat_persisted:true,run_id:prior.data.run_id,observed_at:prior.data.started_at,external_action_performed:false,revenue_claimed:false});
   const observedAt=new Date().toISOString();
   const heartbeat=await db.from("cube_radar_runs").insert({
     started_at:observedAt,
     finished_at:observedAt,
     status:"COMPLETED",
     feeds_seen:0,
     signals_ingested:0,
     signals_qualified:0,
     matches_created:0,
     tests_selected:0,
     external_actions:0,
     errors:0,
     degraded:false,
     evidence:{
       kind:"CLOUD_HEARTBEAT",
       source:"render-cube-economic-heartbeat",
       idempotency_key:idempotencyKey,
       observed_at:observedAt,
       freshness_seconds:0,
       auth_mode:req.headers.get("x-cube-heartbeat-secret")?"custom_shared_secret":"legacy_compatibility",
       external_action_performed:false,
       revenue_claimed:false
     }
   }).select("run_id,started_at,status").single();
   if(heartbeat.error)throw heartbeat.error;
   return out({ok:true,status:"HEARTBEAT_RECORDED",heartbeat_persisted:true,run_id:heartbeat.data.run_id,observed_at:heartbeat.data.started_at,external_action_performed:false,revenue_claimed:false});
 }
 const controller_result=lastControllerResult=await runCloudGauntlet();
 let consumer_result:any=null; try { const cr=await fetch(url+"/functions/v1/economic-assessment-consumer",{method:"POST",headers:{Authorization:"Bearer "+key,apikey:key,"Content-Type":"application/json"},body:JSON.stringify({count:4})}); const ct=await cr.text(); consumer_result={status:cr.status,body:(()=>{try{return JSON.parse(ct)}catch{return {raw:ct}}})()}; } catch(e){ consumer_result={status:"DEGRADED",error:String(e)}; }
 const {data:prior}=await db.from("cube_radar_runs").select("started_at,status,evidence").order("started_at",{ascending:false}).limit(1).maybeSingle();
 if(!manual777 && prior&&Date.now()-new Date(prior.started_at).getTime()<7*86400000)return out({ok:true,skipped:true,reason:"WEEKLY_GATE",last_run:prior.started_at,consumer_result,controller_result,external_action_performed:false,revenue_claimed:false});
 const started=new Date().toISOString();
 const meta=await fetch("https://www.data.gov.au/data/api/3/action/package_show?id=acnc-register",{headers:{accept:"application/json","user-agent":"DreamLedger-ACNC-Signal-Detector/1.0"}});
 if(!meta.ok)throw new Error("ACNC_PACKAGE_"+meta.status);
 const pkg:any=await meta.json(),resources=Array.isArray(pkg?.result?.resources)?pkg.result.resources:[];
 const csvRes=resources.find((r:any)=>/csv/i.test(String(r.format||""))||/csv/i.test(String(r.url||"")));
 if(!csvRes?.url)throw new Error("ACNC_CSV_RESOURCE_NOT_FOUND");
 const fr=await fetch(String(csvRes.url),{headers:{accept:"text/csv,*/*","user-agent":"DreamLedger-ACNC-Signal-Detector/1.0"}});
 if(!fr.ok)throw new Error("ACNC_CSV_"+fr.status);
 const csv=await fr.text(),hash=await sha(csv),sourceUrl=String(csvRes.url),sourceDate=csvRes.last_modified||csvRes.created||pkg.result.metadata_modified||new Date().toISOString();
 const {data:existing}=await db.from("gtm_signals").select("id").eq("source_url",sourceUrl).eq("status","OBSERVED").contains("raw_data",{snapshot_hash:hash}).limit(1).maybeSingle();
 let signal=null;
 if(!existing){
  const ins=await db.from("gtm_signals").insert({signal_type:"ACNC_REGISTER_SNAPSHOT_CHANGE",source:"ACNC_REGISTER",source_url:sourceUrl,source_date:new Date(sourceDate).toISOString(),raw_data:{snapshot_hash:hash,row_count:lines(csv),resource_name:String(csvRes.name||""),package_modified:pkg.result.metadata_modified||null},status:"NEW"}).select("id").single();
  if(ins.error)throw ins.error; signal=ins.data;
  const ds=await db.from("economic_demand_signals").upsert({signal_id:"ACNC-REGISTER-SNAPSHOT-"+hash.slice(0,24),source:"acnc_register",source_ref:sourceUrl,source_url:sourceUrl,observed_at:new Date().toISOString(),silo_id:"MONEY-MODULAR-500-20260927",domain_id:"acnc_charity",problem_text:"ACNC register snapshot changed; refresh charity due-diligence opportunities.",buyer_intent:.7,freshness_score:1,evidence_score:1,fit_score:.95,status:"UNROUTED",approval_required:true,title:"ACNC register update detected",body:"Public ACNC register snapshot changed. Enrichment required before any outreach proposal.",raw_data:{snapshot_hash:hash,row_count:lines(csv),gtm_signal_id:signal.id}},{onConflict:"signal_id"});
  if(ds.error)throw ds.error;
 }
 const finished=new Date().toISOString();
 const run=await db.from("cube_radar_runs").insert({started_at:started,finished_at:finished,status:"COMPLETED",feeds_seen:1,signals_ingested:1,signals_qualified:signal?1:0,matches_created:signal?1:0,tests_selected:0,external_actions:0,errors:0,degraded:false,evidence:{source:"ACNC_REGISTER",source_url:sourceUrl,snapshot_hash:hash,row_count:lines(csv),new_signal:Boolean(signal),external_action_performed:false,revenue_claimed:false}}).select("run_id").single();
 if(run.error)throw run.error;
 return out({ok:true,new_signal:Boolean(signal),signal_id:signal?.id||null,run_id:run.data?.run_id||null,row_count:lines(csv),consumer_result,controller_result,external_action_performed:false,revenue_claimed:false});
}catch(e){const problem=errorInfo(e);console.error("economic-radar-heartbeat failure",JSON.stringify(problem));return out({ok:false,degraded:true,error:problem,controller_result:lastControllerResult,heartbeat_persisted:false,external_action_performed:false,revenue_claimed:false},500)}});