import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const url=Deno.env.get("SUPABASE_URL")!;
const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});

const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});

Deno.serve(async req=>{
  if(req.method!=="POST") return out({error:"POST_REQUIRED"},405);
  const auth=req.headers.get("authorization")||"";
  if(auth!=="Bearer "+key) return out({error:"SERVICE_AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({}));
  const packetId=String(body.packet_id||"");
  if(!packetId) return out({error:"PACKET_ID_REQUIRED"},400);

  const {data:packet,error:pe}=await db.from("economic_execution_packets")
    .select("packet_id,capability_id,status,dispatch_state,authorization_verdict,exact_action,fulfillment_class_id,fulfillment_binding_id")
    .eq("packet_id",packetId).single();
  if(pe||!packet) return out({error:"PACKET_NOT_FOUND"},404);
  const dispatchAuthorized = packet.status==="AUTHORIZED" || (packet.status==="DISPATCHED" && packet.dispatch_state==="INTERNAL_ROUTED" && packet.authorization_verdict==="allow");
  if(!dispatchAuthorized) return out({error:"PACKET_NOT_AUTHORIZED",status:packet.status,dispatch_state:packet.dispatch_state,authorization_verdict:packet.authorization_verdict},409);
  if(packet.capability_id!=="ACNC_RESEARCH_WORKER") return out({error:"UNSUPPORTED_CAPABILITY",capability_id:packet.capability_id},422);

  const signalId=String(packet.exact_action?.signal_id||"");
  const sourceRef=String(packet.exact_action?.source_ref||"");
  const workerUrl=url+"/functions/v1/acnc-research-worker";
  const worker=await fetch(workerUrl,{
    method:"POST",
    headers:{Authorization:"Bearer "+key,apikey:key,"Content-Type":"application/json"},
    body:JSON.stringify({state:"WA",limit:5000})
  });
  const wt=await worker.text();
  let wd:any; try{wd=JSON.parse(wt)}catch{wd={raw:wt}};
  if(!worker.ok || wd?.ok===false){
    await db.from("economic_actions").update({result:{worker_status:"FAILED",worker_response:wd},execution_state:"FAILED"}).eq("action_id",(await db.from("economic_execution_packets").select("action_id").eq("packet_id",packetId).single()).data?.action_id);
    return out({ok:false,error:"WORKER_FAILED",worker:wd},502);
  }

  const {data:ep}=await db.from("economic_execution_packets").select("action_id").eq("packet_id",packetId).single();
  if(ep?.action_id){
    await db.from("economic_actions").update({
      result:{
        fulfillment_class_id:packet.fulfillment_class_id,
        capability_id:packet.capability_id,
        signal_id:signalId,
        source_ref:sourceRef,
        worker:"ACNC_RESEARCH_WORKER",
        source_manifest:wd.source_manifest,
        quality_report:wd.quality_report,
        records:wd.records||wd.deliverable_rows||[],
        decision_maker_enrichment_queue:wd.decision_maker_enrichment_queue||[],
        deliverable_csv:wd.deliverable_csv||null,
        validation:wd.validation||null
      },
      execution_state:"PREPARED"
    }).eq("action_id",ep.action_id);
  }

  return out({
    ok:true,
    packet_id:packetId,
    signal_id:signalId,
    capability_id:packet.capability_id,
    records:(wd.records||wd.deliverable_rows||[]).length,
    enrichment_queue:(wd.decision_maker_enrichment_queue||[]).length,
    quality_report:wd.quality_report||wd.validation,
    external_action_performed:false,
    external_submission_required:true
  });
});