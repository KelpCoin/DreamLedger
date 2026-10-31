// Evidence ingress. Image bytes are private; hash is computed server-side.
// Supabase service role is never returned to caller. Do not enable public storage access.
// Deno runtime types are built in; no JSR dependency required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
const ORIGIN="https://dreamledger.org";
const headers={"Access-Control-Allow-Origin":ORIGIN,"Vary":"Origin",
 "Access-Control-Allow-Headers":"authorization, apikey, content-type",
 "Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store",
 "Content-Type":"application/json; charset=utf-8"};
const json=(obj:unknown,status=200)=>new Response(JSON.stringify(obj),{status,headers});
function mime(b:Uint8Array):string|null {
 if(b.length>=8&&b.slice(0,8).every((x,i)=>x===[137,80,78,71,13,10,26,10][i]))return "image/png";
 if(b.length>=4&&b[0]===255&&b[1]===216&&b[2]===255)return "image/jpeg";
 if(b.length>=12&&new TextDecoder().decode(b.slice(0,4))==="RIFF"&&new TextDecoder().decode(b.slice(8,12))==="WEBP")return "image/webp";
 return null;
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
 const origin=req.headers.get("origin");
 if(origin&&origin!==ORIGIN)return json({error:"ORIGIN_REJECTED"},403);
 const jwt=req.headers.get("authorization")||"";
 if(!jwt.startsWith("Bearer ")||jwt.length>5000)return json({error:"LOGIN_REQUIRED"},401);
 const base=Deno.env.get("SUPABASE_URL"),publicKey=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
 const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!base||!publicKey||!serviceKey)return json({error:"EVIDENCE_BACKEND_UNAVAILABLE"},503);
 const auth=createClient(base,publicKey,{global:{headers:{Authorization:jwt}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authErr}=await auth.auth.getUser();
 if(authErr||!user||!user.email_confirmed_at)return json({error:"VERIFIED_ACCOUNT_REQUIRED"},403);
 const admin=createClient(base,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:seller,error:sellerErr}=await admin.from("mtg_seller_profiles_v2").select("status").eq("user_id",user.id).maybeSingle();
 if(sellerErr)return json({error:"SELLER_LOOKUP_FAILED"},503);
 if(!seller||seller.status==="suspended")return json({error:"SELLER_REGISTRATION_REQUIRED"},403);
 const ct=(req.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
 if(!["image/png","image/jpeg","image/webp"].includes(ct))return json({error:"IMAGE_CONTENT_TYPE_REQUIRED"},415);
 const cl=Number(req.headers.get("content-length")||0);
 if(cl>5242880)return json({error:"FILE_TOO_LARGE"},413);
 const bytes=new Uint8Array(await req.arrayBuffer());
 if(bytes.byteLength<32||bytes.byteLength>5242880)return json({error:"INVALID_IMAGE_SIZE"},413);
 const detected=mime(bytes);
 if(!detected||detected!==ct)return json({error:"IMAGE_MAGIC_MISMATCH"},415);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(b=>b.toString(16).padStart(2,"0")).join("");
 const key=user.id+"/"+hash+"."+(ct==="image/jpeg"?"jpg":ct==="image/png"?"png":"webp");
 const {data:existing,error:lookupErr}=await admin.from("mtg_auction_evidence_v2").select("id,storage_key").eq("owner_id",user.id).eq("sha256",hash).maybeSingle();
 if(lookupErr)return json({error:"EVIDENCE_LOOKUP_FAILED"},503);
 if(existing)return json({ok:true,sha256:hash,evidence_id:existing.id,idempotent:true});
 const {error:uploadErr}=await admin.storage.from("mtg-auction-evidence").upload(key,bytes,
 {contentType:ct,cacheControl:"0",upsert:false});
 if(uploadErr)return json({error:"EVIDENCE_UPLOAD_RETRY_OR_CONFLICT"},503);
 const {data:evidence,error:writeErr}=await admin.from("mtg_auction_evidence_v2")
 .insert({owner_id:user.id,sha256:hash,storage_key:key,content_type:ct,byte_size:bytes.byteLength})
 .select("id").single();
 if(writeErr)return json({error:"EVIDENCE_RECORD_REQUIRES_RECONCILIATION"},503);
 return json({ok:true,sha256:hash,evidence_id:evidence.id,idempotent:false});
});
