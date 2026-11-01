// Same-origin bridge to the existing Supabase paid Commander diagnostic intake.
// Payment, inventory and entitlement authority remain in Stripe + the existing
// Supabase service. This function never marks an order paid or delivered.
const TARGET="https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/marketplace-diagnostic-input";
const STATUS="https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/mtg-commander-status";
const ORIGINS=new Set(["https://dreamledger.org","https://www.dreamledger.org"]);
const SID=/^cs_(live|test)_[A-Za-z0-9_]{10,180}$/;
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{
 status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",
 "x-content-type-options":"nosniff"}
});
export default async function handler(req:Request):Promise<Response>{
 if(req.method!=="POST")return json(405,{error:"METHOD_NOT_ALLOWED"});
 if(!ORIGINS.has(req.headers.get("origin")||""))return json(403,{error:"ORIGIN_REJECTED"});
 if(!(req.headers.get("content-type")||"").toLowerCase().startsWith("application/json"))
   return json(415,{error:"JSON_REQUIRED"});
 const advertised=Number(req.headers.get("content-length")||0);
 if(advertised>32768)return json(413,{error:"INPUT_TOO_LARGE"});
 let body:any;
 try{
  const raw=await req.text();
  if(new TextEncoder().encode(raw).length>32768)return json(413,{error:"INPUT_TOO_LARGE"});
  body=JSON.parse(raw);
 }catch{return json(400,{error:"INVALID_JSON"})}
 if(!body||typeof body!=="object"||Array.isArray(body)||
    !SID.test(String(body.session_id||""))||
    typeof body.decklist!=="string"||body.decklist.length<20||body.decklist.length>30000)
   return json(422,{error:"INVALID_DIAGNOSTIC_INPUT"});
 // Browser navigation is not authorization. Require an independent read-only
 // provider-backed exact Price/SKU + webhook order check on every POST.
 let check:Response;
 try{
  check=await fetch(STATUS+"?session_id="+encodeURIComponent(body.session_id),{
   method:"GET",redirect:"error",cache:"no-store",
   headers:{"accept":"application/json","origin":"https://dreamledger.org"},
   signal:AbortSignal.timeout(6500)});
 }catch{return json(503,{error:"DIAGNOSTIC_PAYMENT_VERIFIER_UNAVAILABLE",retryable:true})}
 if(!check.ok)return json(503,{error:"DIAGNOSTIC_PAYMENT_VERIFIER_UNAVAILABLE",retryable:true});
 let verdict:any;
 try{
  const raw=await check.text();
  if(raw.length>2048)throw Error("oversized verifier response");
  verdict=JSON.parse(raw);
 }catch{return json(503,{error:"DIAGNOSTIC_PAYMENT_VERIFIER_INVALID",retryable:true})}
 if(verdict?.state!=="paid_recorded"||verdict?.retryable!==false){
  if(verdict?.state==="product_mismatch"||verdict?.state==="invalid_session")
   return json(409,{error:"DIAGNOSTIC_PAYMENT_CONTRACT_MISMATCH"});
  if(verdict?.state==="awaiting_payment"||verdict?.state==="paid_pending_record")
   return json(409,{error:"PAYMENT_OR_FULFILLMENT_NOT_READY",retryable:verdict.state==="paid_pending_record"});
  return json(503,{error:"DIAGNOSTIC_PAYMENT_VERIFIER_UNAVAILABLE",retryable:true});
 }
 let response:Response;
 try{
  response=await fetch(TARGET,{method:"POST",redirect:"error",headers:{
   "content-type":"application/json","accept":"application/json"},
   body:JSON.stringify({session_id:body.session_id,decklist:body.decklist}),
   signal:AbortSignal.timeout(10000)});
 }catch{return json(503,{error:"DIAGNOSTIC_INPUT_BACKEND_UNAVAILABLE",retryable:true})}
 let result:any;
 try{
  const text=await response.text();
  if(text.length>8192)throw Error("oversized response");
  result=JSON.parse(text);
 }catch{return json(503,{error:"DIAGNOSTIC_INPUT_BACKEND_INVALID",retryable:true})}
 if(!response.ok){
  if(response.status===409)return json(409,{error:"PAYMENT_OR_FULFILLMENT_NOT_READY",retryable:true});
  if(response.status===400)return json(400,{error:"DIAGNOSTIC_INPUT_NOT_ELIGIBLE"});
  return json(503,{error:"DIAGNOSTIC_INPUT_NOT_CONFIRMED",retryable:true});
 }
 if(result?.ok!==true||!result?.fulfillment_id||result?.status!=="queued")
   return json(503,{error:"DIAGNOSTIC_INPUT_UNCONFIRMED",retryable:true});
 return json(202,{ok:true,status:"queued",fulfillment_id:String(result.fulfillment_id),
  report_delivered:false,payment_verified_by:"existing_supabase_intake"});
}
