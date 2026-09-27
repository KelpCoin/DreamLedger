import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const json=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json"}});
const authorized=(r:Request)=>r.headers.get("authorization")==="Bearer "+key||r.headers.get("apikey")===key;
async function call(name:string,body:unknown){const r=await fetch(url+"/functions/v1/"+name,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+key,"apikey":key},body:JSON.stringify(body)});const t=await r.text();let j:any;try{j=JSON.parse(t)}catch{j={raw:t}}return{status:r.status,body:j};}
Deno.serve(async req=>{try{
if(req.method!=="POST")return json({error:"POST_REQUIRED"},405);if(!authorized(req))return json({error:"SERVICE_ROLE_REQUIRED"},403);
const b=await req.json().catch(()=>({})),ids=Array.isArray(b.silo_ids)?b.silo_ids.map(String):[],count=Math.max(1,Math.min(Number(b.count||10),20));
let q=db.from("economic_silo_registry").select("*").in("lifecycle_stage",["CANDIDATE","RESEARCH"]).order("created_at",{ascending:true}).limit(count);
if(ids.length)q=db.from("economic_silo_registry").select("*").in("silo_id",ids);
const {data:silos,error}=await q;if(error)throw error;const results=[];
for(const silo of silos||[]){
const proposal={cell_id:silo.silo_id,sku:silo.silo_id,buyer:silo.domain_id||"UNKNOWN",economic_job:silo.template_key,documented_problem:silo.buyer_problem,proposed_deliverable:silo.proposed_deliverable,distribution_channel:"PUBLIC_SILO_ROUTE",fulfillment_possibility:silo.proposed_deliverable,price_nzd:0,approval_required:true,external_action_allowed:false,evidence_status:silo.evidence_status,source_signal:{signal_id:silo.source_signal_id},evidence_map:[],pre_registration:{prediction_text:"Candidate remains eligible only if evidence supports a concrete buyer problem and bounded deliverable.",success_condition:"Gauntlet establishes grounded evidence and a bounded commercial path.",failure_condition:"Evidence remains insufficient or claims cannot be grounded.",observation_window_end:new Date(Date.now()+604800000).toISOString()},failure_condition:"Evidence remains insufficient or claims cannot be grounded.",kill_condition:"No grounded demand or bounded fulfillment path."};
await db.from("silo_agent_runs").insert({silo_id:silo.silo_id,agent:"ELOHIM",stage:"PROPOSAL",status:"QUEUED",output:{mode:"WAIT_FOR_COMMERCE_CELL",reason:"elohim-cube consumes cube_cells; candidate remains non-commerce until qualified."}});
const g=await call("gauntlet-cube",{cell_id:silo.silo_id,proposal});const verdict=g.body?.result?.verdict||g.body?.run?.verdict||"ERROR";
await db.from("silo_agent_runs").insert({silo_id:silo.silo_id,agent:"GAUNTLET",stage:"ADVERSARIAL_GATE",status:g.status>=200&&g.status<300?"COMPLETE":"ERROR",output:g.body||{},error:g.status>=300?JSON.stringify(g.body):null,completed_at:new Date().toISOString()});
const stage=verdict==="PASS"?"QUALIFIED":verdict==="FAIL"?"REJECTED":"RESEARCH";
await db.from("economic_silo_registry").update({lifecycle_stage:stage,qualification_status:verdict,evidence_status:verdict==="PASS"?"GROUNDED":"UNVERIFIED",updated_at:new Date().toISOString()}).eq("silo_id",silo.silo_id);
results.push({silo_id:silo.silo_id,gauntlet_verdict:verdict,next_stage:stage,elohim:"QUEUED_UNTIL_COMMERCE_CELL"});
}
const {data:summary}=await db.rpc("economic_silo_registry_summary");return json({ok:true,processed:results.length,results,registry:summary});
}catch(e){return json({error:String(e)},500)}});