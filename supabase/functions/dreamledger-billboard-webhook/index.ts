import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"";
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const STRIPE_SECRET_KEY=Deno.env.get("STRIPE_SECRET_KEY")??"";
const WEBHOOK_SECRET=Deno.env.get("STRIPE_WEBHOOK_SECRET")??"";
const PRICE_ID="price_1U8xD6EGgEAnUFF9KGrq2t7X";
const SKU="DL-BILLBOARD-100X100-3000-001";
function hexToBytes(h:string){const o=new Uint8Array(Math.floor(h.length/2));for(let i=0;i<o.length;i++)o[i]=parseInt(h.slice(i*2,i*2+2),16);return o}
function eq(a:Uint8Array,b:Uint8Array){if(a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a[i]^b[i];return v===0}
async function verify(raw:string,header:string){let t="",v1:string[]=[];for(const part of header.split(",")){const[k,v]=part.split("=",2);if(k==="t")t=v??"";if(k==="v1"&&v)v1.push(v)}const ts=Number(t);const age=Math.abs(Math.floor(Date.now()/1000)-ts);if(!t||!v1.length||!Number.isFinite(age)||age>300||!WEBHOOK_SECRET)return false;const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(WEBHOOK_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(ts+"."+raw)));return v1.some(x=>eq(sig,hexToBytes(x)))}
async function db(path:string,init:RequestInit={}){return fetch(SUPABASE_URL+"/rest/v1/"+path,{...init,headers:{apikey:SERVICE_ROLE_KEY,Authorization:"Bearer "+SERVICE_ROLE_KEY,"Content-Type":"application/json",...(init.headers||{})}})}
async function stripe(path:string,init:RequestInit={}){return fetch("https://api.stripe.com/v1/"+path,{...init,headers:{Authorization:"Basic "+btoa(STRIPE_SECRET_KEY+":"),...(init.headers||{})}})}
async function refund(paymentIntent:string){if(!paymentIntent)return false;const r=await stripe("refunds",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({payment_intent:paymentIntent})});return r.ok}
function field(session:any,key:string){const f=(session.custom_fields||[]).find((x:any)=>x.key===key);return String(f?.text?.value??f?.numeric?.value??f?.dropdown?.value??"").trim()}
function json(status:number,data:unknown){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}})}
Deno.serve(async req=>{
 if(req.method!=="POST")return json(405,{error:"Method not allowed"});
 if(!SUPABASE_URL||!SERVICE_ROLE_KEY||!STRIPE_SECRET_KEY||!WEBHOOK_SECRET)return json(503,{error:"Webhook configuration incomplete"});
 const raw=await req.text();
 if(!(await verify(raw,req.headers.get("stripe-signature")||"")))return json(400,{error:"Invalid Stripe signature"});
 let event:any;try{event=JSON.parse(raw)}catch{return json(400,{error:"Invalid JSON"})}
 if(event.livemode!==true)return json(200,{received:true,ignored:"test_mode_event",note:"RA_000001 provenance gate: TEST-mode Stripe events are intentionally never fulfilled or written to production economic tables. This event was signature-verified but not processed."});
 if(event.type!=="checkout.session.completed")return json(200,{received:true,ignored:event.type});
 const s=event.data?.object||{};const m=s.metadata||{};
 if(String(m.sku||"")!==SKU)return json(200,{received:true,ignored:"non_billboard"});
 if(String(s.payment_status||"")!=="paid")return json(200,{received:true,ignored:"not_paid"});
 if(String(s.currency||"").toLowerCase()!=="nzd"||Number(s.amount_total)!==5000)return json(400,{error:"Unexpected payment amount or currency"});
 const lr=await stripe("checkout/sessions/"+encodeURIComponent(String(s.id))+"/line_items?limit=100");if(!lr.ok)return json(502,{error:"Could not retrieve Stripe line items"});
 const li=await lr.json();const prices=(li.data||[]).map((i:any)=>String(i.price?.id||""));if(!prices.includes(PRICE_ID))return json(400,{error:"Canonical billboard price missing"});
 const label=field(s,"billboard_label");const destination=field(s,"destination_url");
 const email=String(s.customer_details?.email||s.customer_email||"").trim()||null;
 try{
   const rpc=await db("rpc/billboard_publish_paid",{method:"POST",body:JSON.stringify({p_sku:SKU,p_checkout_session:String(s.id),p_payment_intent:String(s.payment_intent||""),p_customer_email:email,p_label:label,p_destination_url:destination,p_amount_nzd:50,p_currency:"NZD",p_stripe_event_id:String(event.id)})});
   const textBody=await rpc.text();
   if(!rpc.ok){const refunded=await refund(String(s.payment_intent||""));return json(refunded?200:500,{received:true,refunded,reason:"Billboard payment could not be safely fulfilled"})}
   const result=JSON.parse(textBody);return json(200,{received:true,billboard:true,fulfillment:result?.[0]||result});
 }catch(e){return json(500,{error:String(e?.message||e)})}
});
