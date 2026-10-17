import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const db=createClient(SUPABASE_URL,SERVICE_ROLE_KEY);
const BUCKET="marketplace-fulfillment";

async function sha256(bytes:Uint8Array){const digest=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");}

Deno.serve(async(req)=>{
  if(req.method!=="POST") return new Response("POST only",{status:405});
  try{
    const body=await req.json();
    const fulfillmentId=String(body.fulfillment_id||"").trim();
    const workerId=String(body.worker_id||"").trim();
    const leaseToken=String(body.lease_token||"").trim();
    const storagePath=String(body.storage_path||"").trim();
    const expectedSha=String(body.sha256||"").trim().toLowerCase();
    const mimeType=String(body.mime_type||"text/markdown");
    const deliveryUrl=String(body.delivery_url||"").trim();
    if(!fulfillmentId||!workerId||!leaseToken||!storagePath||!/^[0-9a-f]{64}$/.test(expectedSha)||!deliveryUrl) return Response.json({error:"invalid verifier input"},{status:400});
    if(!storagePath.startsWith(fulfillmentId+"/")) return Response.json({error:"storage path must be fulfillment scoped"},{status:400});
    const {data:blob,error:downloadError}=await db.storage.from(BUCKET).download(storagePath);
    if(downloadError||!blob) return Response.json({error:"artifact not found in private storage"},{status:404});
    const bytes=new Uint8Array(await blob.arrayBuffer());
    const actualSha=await sha256(bytes);
    if(actualSha!==expectedSha) return Response.json({error:"artifact hash mismatch",expected:expectedSha,actual:actualSha},{status:409});
    const {data:f,error:lookupError}=await db.from("marketplace_fulfillments").select("fulfillment_id,status,metadata").eq("fulfillment_id",fulfillmentId).single();
    if(lookupError||!f) return Response.json({error:"fulfillment not found"},{status:404});
    if(f.status!=="in_progress") return Response.json({error:"fulfillment not in progress",status:f.status},{status:409});
    const {error:completeError}=await db.rpc("marketplace_complete_diagnostic_fulfillment",{p_fulfillment_id:fulfillmentId,p_worker_id:workerId,p_lease_token:leaseToken,p_bucket:BUCKET,p_storage_path:storagePath,p_sha256:actualSha,p_mime_type:mimeType,p_byte_size:bytes.byteLength,p_delivery_url:deliveryUrl});
    if(completeError) return Response.json({error:completeError.message},{status:409});
    return Response.json({ok:true,fulfillment_id:fulfillmentId,sha256:actualSha,bytes:bytes.byteLength});
  }catch(error){return Response.json({error:String(error?.message||error)},{status:500});}
});
