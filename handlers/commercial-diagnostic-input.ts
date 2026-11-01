// Same-origin bridge to the existing Supabase paid Commander diagnostic intake.
// Payment, inventory and entitlement authority remain in Stripe + the existing
// Supabase service. This function never marks an order paid or delivered.
const TARGET="https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/marketplace-diagnostic-input";
const STATUS="https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/mtg-commander-status";
const ORIGINS=new Set(["https://dreamledger.org","https://www.dreamledger.org"]);
const SID=/^cs_(live|test)_[A-Za-z0-9_]{10,180}$/;
// A paid diagnostic must receive a complete 100-card Commander list before
// any upstream payment lookup or durable intake. Card legality is not inferred.
function decklistError(text:string):string|null{
 let total=0,entries=0;
 for(const raw of text.split(/\r?\n/)){
  const line=raw.trim();
  if(!line||line.startsWith("#")||line.startsWith("//"))continue;
  if(/^(sideboard|maybeboard|considering)\b/i.test(line))return "DECKLIST_UNSUPPORTED_SECTION";
  if(/^(commander|mainboard|deck)\s*:\s*$/i.test(line))continue;
  const card=line.replace(/^(commander|mainboard|deck)\s*:\s*/i,"");
  const match=/^(\d{1,3})x?\s+(.+)$/i.exec(card);
  if(/^\d/.test(card)&&!match)return "DECKLIST_INVALID_CARD";
  const quantity=match?Number(match[1]):1;
  const name=(match?match[2]:card).trim();
  if(!name||name.length>160||quantity<1||quantity>100||
     /[<>{}\u0000-\u001f]/.test(name)||/https?:\/\/|www\./i.test(name))
   return "DECKLIST_INVALID_CARD";
  total+=quantity;
  entries++;
  if(total>100||entries>100)return "DECKLIST_CARD_COUNT";
 }
 return total===100?null:"DECKLIST_CARD_COUNT";
}
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
 const deckError=decklistError(body.decklist);
 if(deckError)return json(422,{error:deckError,expected_cards:100});
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
