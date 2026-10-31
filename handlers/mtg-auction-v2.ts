import {verifyAuctionAllocation,AUCTION_MUTATION_ACTIONS} from "../BEC-PRIME/capabilities/auction/authorization.mjs";
/** MTG-only Auth + PostgREST gateway. No service-role key or fake bids here.
 * Requires Supabase DB migration and SUPABASE_URL plus publishable/anon key.
 * Authenticated mutations execute atomic RPCs under the caller's JWT. */
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{
  "content-type":"application/json; charset=utf-8","cache-control":"no-store",
  "x-content-type-options":"nosniff","referrer-policy":"no-referrer"}});
const routes={
 register:["mtg_seller_register_v2",[]],
 inventory:["mtg_inventory_submit_v2",["p_title","p_condition","p_evidence_sha256"]],
 auction_submit:["mtg_auction_submit_v2",["p_inventory","p_start_cents","p_increment_cents","p_reserve_cents","p_ends_at"]],
 buy_now_set:["mtg_auction_set_buy_now_v2",["p_auction","p_buy_now_cents"]],
 buy_now:["mtg_auction_buy_now_v2",["p_auction"]],
 bid:["mtg_auction_bid_v2",["p_auction","p_amount_cents","p_request_id"]],
 ship:["mtg_auction_ship_v2",["p_order","p_proof_sha256"]],
 deliver:["mtg_auction_deliver_v2",["p_order"]],
 dispute:["mtg_auction_dispute_v2",["p_order","p_reason"]]
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function configured(){
 const base=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
 const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||"";
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base)||!key)throw Error("NOT_CONFIGURED");
 return {base,key};
}
export default async function handler(request){
 const url=new URL(request.url), action=url.searchParams.get("action")||"list";
 if(request.method!=="GET"&&request.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
 const origin=request.headers.get("origin");
 if(request.method==="POST"&&origin&&origin!==url.origin)return json({error:"ORIGIN_REJECTED"},403);
 let env;try{env=configured()}catch{return json({error:"AUCTION_BACKEND_NOT_CONFIGURED",live:false},503)}
 const access=request.headers.get("authorization")||"";
 const auth=access.startsWith("Bearer ")&&access.length<5000?access:null;
 const h={"apikey":env.key,"content-type":"application/json","accept":"application/json"};
 if(auth)h.authorization=auth;
 let endpoint="",method="GET",payload,authorized=false;
 if(action==="evidence_config"&&request.method==="GET"){
   if(!auth)return json({error:"LOGIN_REQUIRED"},401);
   return json({url:env.base+"/functions/v1/mtg-auction-evidence",apikey:env.key,max_bytes:5242880,
     accepted_types:["image/jpeg","image/png","image/webp"]});
 }else if(action==="list"&&request.method==="GET"){
   endpoint="/rest/v1/mtg_auction_lots_v2?select=id,title,currency,start_cents,increment_cents,high_bid_cents,buy_now_cents,status,ends_at,version&status=eq.open&order=ends_at.asc&limit=50";
 }else if(action==="my_orders"&&request.method==="GET"){
   if(!auth)return json({error:"LOGIN_REQUIRED"},401);
   endpoint="/rest/v1/mtg_auction_orders_v2?select=id,auction_id,amount_cents,currency,status,paid_at,shipped_at,delivered_at&order=created_at.desc&limit=50";
 }else if(action==="checkout"&&request.method==="POST"){
   if(!auth)return json({error:"LOGIN_REQUIRED"},401);
   let p;try{p=await request.json()}catch{return json({error:"INVALID_JSON"},400)}
   if(!uuid.test(p?.order_id))return json({error:"INVALID_ORDER_ID"},422);
   endpoint="/functions/v1/mtg-auction-checkout";method="POST";payload=JSON.stringify({order_id:p.order_id});authorized=true;
 }else if((action==="signup"||action==="login")&&request.method==="POST"){
   let p;try{p=await request.json()}catch{return json({error:"INVALID_JSON"},400)}
   if(typeof p.email!=="string"||p.email.length>254||typeof p.password!=="string"||p.password.length>128||p.password.length<8)return json({error:"INVALID_CREDENTIAL_FORMAT"},422);
   endpoint=action==="signup"?"/auth/v1/signup":"/auth/v1/token?grant_type=password";
   method="POST";payload=JSON.stringify({email:p.email.trim(),password:p.password});
 }else if(request.method==="POST"&&Object.prototype.hasOwnProperty.call(routes,action)){
   if(!auth)return json({error:"LOGIN_REQUIRED"},401);
   const [name,keys]=routes[action];let b;
   try{b=await request.json()}catch{return json({error:"INVALID_JSON"},400)}
   if(!b||typeof b!=="object"||Array.isArray(b))return json({error:"INVALID_PAYLOAD"},400);
   if(Object.keys(b).some(k=>!keys.includes(k))||keys.some(k=>!(k in b)))return json({error:"UNEXPECTED_OR_MISSING_FIELDS"},422);
   if(action==="buy_now"&&!uuid.test(b.p_auction))return json({error:"INVALID_AUCTION_ID"},422);
   if(action==="buy_now_set"&&(!uuid.test(b.p_auction)||
     (b.p_buy_now_cents!==null&&(!Number.isSafeInteger(b.p_buy_now_cents)||b.p_buy_now_cents<100||b.p_buy_now_cents>100000000000))))
     return json({error:"INVALID_BUY_NOW_PRICE"},422);
   if(action==="bid"&&(!uuid.test(b.p_auction)||!uuid.test(b.p_request_id)||!Number.isSafeInteger(b.p_amount_cents)||b.p_amount_cents<100))return json({error:"INVALID_BID"},422);
   if(action==="auction_submit"&&(!uuid.test(b.p_inventory)||!Number.isSafeInteger(b.p_start_cents)||!Number.isSafeInteger(b.p_increment_cents)||!Number.isSafeInteger(b.p_reserve_cents)))return json({error:"INVALID_AUCTION"},422);
   if(action==="inventory"&&(!/^[0-9a-f]{64}$/.test(b.p_evidence_sha256||"")||typeof b.p_title!=="string"||typeof b.p_condition!=="string"))return json({error:"INVALID_EVIDENCE"},422);
   endpoint="/rest/v1/rpc/"+name;method="POST";payload=JSON.stringify(b);authorized=true;
 }else{return json({error:"UNKNOWN_AUCTION_ACTION"},404)}
 // Kingdom owns resource allocation. MTG is an isolated consumer of the shared capability.
 // The grant is server-side only, HMAC-signed by an owner-approved Gauntlet authority,
 // bound to this silo, this exact deployed commit, a fixed operation set and expiry.
 if(request.method==="POST"&&AUCTION_MUTATION_ACTIONS.includes(action)){
   const decision=verifyAuctionAllocation({
     envelope:process.env.KINGDOM_AUCTION_ALLOCATION_JSON||"",
     secret:process.env.KINGDOM_AUCTION_ALLOCATION_SECRET||"",
     siloId:"mtg-master",action,
     deploymentSha:process.env.VERCEL_GIT_COMMIT_SHA||process.env.KINGDOM_AUCTION_DEPLOYMENT_SHA||""
   });
   if(!decision.ok)return json({error:"KINGDOM_GAUNTLET_ALLOCATION_HOLD",gate:decision.code},503);
 }
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);
 try{
   const upstream=await fetch(env.base+endpoint,{method,headers:h,body:payload,signal:controller.signal,redirect:"error"});
   const data=await upstream.json().catch(()=>({error:"INVALID_UPSTREAM_RESPONSE"}));
   if(!upstream.ok){
     const missing=data?.code==="PGRST202"||(upstream.status===404&&!data?.message);
     const known={
       BID_TOO_LOW:["OUTBID",409],
       BUY_NOW_UNAVAILABLE:["BUY_NOW_UNAVAILABLE",409],
       SELF_PURCHASE_FORBIDDEN:["SELF_PURCHASE_FORBIDDEN",403],
       DRAFT_SELLER_REQUIRED:["DRAFT_SELLER_REQUIRED",403],
       BIDDING_CLOSED:["AUCTION_CLOSED",409],
       SELF_BIDDING_FORBIDDEN:["SELF_BIDDING_FORBIDDEN",403],
       VERIFIED_BUYER_EMAIL_REQUIRED:["EMAIL_CONFIRMATION_REQUIRED",403],
       SELLER_OR_STOCK_UNVERIFIED:["SELLER_OR_STOCK_UNVERIFIED",409],
       IDEMPOTENCY_KEY_REUSED:["IDEMPOTENCY_CONFLICT",409],
       AUCTION_NOT_FOUND:["AUCTION_NOT_FOUND",404]
     };
     const mapped=authorized?known[data?.message]:null;
     return json({error:missing?"AUCTION_SCHEMA_NOT_DEPLOYED":mapped?mapped[0]:(authorized?"AUCTION_OPERATION_REJECTED":"UPSTREAM_REJECTED"),
       code:data?.code||null},missing?503:mapped?mapped[1]:upstream.status);
   }
   if(action==="login"||action==="signup")return json({
     access_token:data.access_token||null,expires_in:data.expires_in||null,
     confirmation_required:!data.access_token
   });
   return json(action==="list"?{live:true,auctions:Array.isArray(data)?data:[]}:
     action==="my_orders"?{orders:Array.isArray(data)?data:[]}: {result:data});
 }catch{return json({error:"AUCTION_UPSTREAM_UNAVAILABLE",live:false},503)}
 finally{clearTimeout(timeout)}
}
