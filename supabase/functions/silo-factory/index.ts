import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const json=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json"}});
const authorized=(r:Request)=>r.headers.get("authorization")==="Bearer "+key||r.headers.get("apikey")===key;
Deno.serve(async req=>{try{
if(req.method!=="POST")return json({error:"POST_REQUIRED"},405);if(!authorized(req))return json({error:"SERVICE_ROLE_REQUIRED"},403);
const b=await req.json().catch(()=>({})),requested=Math.max(1,Math.min(Number(b.count||1000),5000)),batch=crypto.randomUUID();
const {error:ce}=await db.from("silo_factory_batches").insert({batch_id:batch,requested_count:requested,generator_version:"SILO-FACTORY-2026-09-27-v1",status:"RUNNING"});
if(ce)throw ce;
const {data,error}=await db.rpc("populate_silo_registry",{p_target:Math.min(requested,50000)});if(error)throw error;
await db.from("silo_factory_batches").update({inserted_count:Number(data?.inserted||0),source_signal_count:Number(data?.source_signals_used||0),status:"COMPLETE",completed_at:new Date().toISOString(),metadata:{summary:data}}).eq("batch_id",batch);
const {data:summary}=await db.rpc("economic_silo_registry_summary");return json({ok:true,batch_id:batch,summary:data,registry:summary});
}catch(e){return json({error:String(e)},500)}});