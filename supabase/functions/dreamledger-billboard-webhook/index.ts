const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"";
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const STRIPE_SECRET_KEY=Deno.env.get("STRIPE_SECRET_KEY")??"";
const WEBHOOK_SECRET=Deno.env.get("STRIPE_WEBHOOK_SECRET")??"";

const PAYMENT_LINK_ID="plink_1UCrekEGgEAnUFF9XVRM04aG";
const PRICE_ID="price_1UCrecEGgEAnUFF9lximUXtk";
const SKU="DREAMLEDGER-BILLBOARD-FOUNDING-001";
const WIDTH=100,HEIGHT=100,PRICE_NZD=50,AMOUNT_MINOR=5000,MARKET="GLOBAL";
const ACTIVE_STATUSES=["PUBLISHED","PAID_PENDING_REVIEW"];

function json(status:number,data:unknown){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}})}
function hexToBytes(h:string){const o=new Uint8Array(Math.floor(h.length/2));for(let i=0;i<o.length;i++)o[i]=parseInt(h.slice(i*2,i*2+2),16);return o}
function eq(a:Uint8Array,b:Uint8Array){if(a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a[i]^b[i];return v===0}
async function verify(raw:string,header:string){
 let t="",v1:string[]=[];
 for(const part of header.split(",")){const[k,v]=part.split("=",2);if(k==="t")t=v??"";if(k==="v1"&&v)v1.push(v)}
 const ts=Number(t),age=Math.abs(Math.floor(Date.now()/1000)-ts);
 if(!t||!v1.length||!Number.isFinite(age)||age>300||!WEBHOOK_SECRET)return false;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(WEBHOOK_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(ts+"."+raw)));
 return v1.some(x=>eq(sig,hexToBytes(x)));
}
async function db(path:string,init:RequestInit={}){
 return fetch(SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/"+path,{...init,headers:{apikey:SERVICE_ROLE_KEY,Authorization:"Bearer "+SERVICE_ROLE_KEY,"Content-Type":"application/json",...(init.headers||{})}});
}
async function stripe(path:string,init:RequestInit={}){
 return fetch("https://api.stripe.com/v1/"+path,{...init,headers:{Authorization:"Basic "+btoa(STRIPE_SECRET_KEY+":"),...(init.headers||{})}});
}
async function refund(paymentIntent:string,reason:string){
 if(!STRIPE_SECRET_KEY||!paymentIntent)return false;
 const r=await stripe("refunds",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({payment_intent:paymentIntent,reason:"requested_by_customer","metadata[reason]":reason})});
 return r.ok;
}
function field(session:any,key:string){
 const f=(session.custom_fields||[]).find((x:any)=>x.key===key);
 return String(f?.text?.value??f?.numeric?.value??f?.dropdown?.value??"").trim();
}
function validHttps(value:string){try{return new URL(value).protocol==="https:"}catch{return false}}
function slotIndex(x:number,y:number){return Math.floor(y/100)*10+Math.floor(x/100)}
function findFree(rows:any[]){
 const used=new Set<number>();
 for(const row of rows){
   const x=Number(row.x),y=Number(row.y),w=Number(row.width||100),h=Number(row.height||100);
   for(let yy=y;yy<y+h;yy+=100)for(let xx=x;xx<x+w;xx+=100)if(xx>=0&&yy>=0&&xx<1000&&yy<1000)used.add(slotIndex(xx,yy));
 }
 for(let i=0;i<100;i++)if(!used.has(i))return {index:i,x:(i%10)*100,y:Math.floor(i/10)*100,used:used.size};
 return null;
}
async function health(){
 const config={
   supabase_url_present:Boolean(SUPABASE_URL),
   service_role_present:Boolean(SERVICE_ROLE_KEY),
   stripe_secret_present:Boolean(STRIPE_SECRET_KEY),
   webhook_secret_present:Boolean(WEBHOOK_SECRET)
 };
 if(!config.supabase_url_present||!config.service_role_present)return {ok:false,config,db_ok:false,table_ok:false,remaining_units:null};
 try{
   const r=await db("billboard_campaigns?select=campaign_id,status,x,y,width,height&status=in.(PUBLISHED,PAID_PENDING_REVIEW)&limit=100");
   const text=await r.text();
   if(!r.ok)return {ok:false,config,db_ok:false,table_ok:false,status:r.status,remaining_units:null};
   const rows=JSON.parse(text);
   const free=findFree(rows);
   return {ok:Object.values(config).every(Boolean)&&Boolean(free),config,db_ok:true,table_ok:true,active_rows:rows.length,remaining_units:free?100-free.used:0,canonical:{payment_link_id:PAYMENT_LINK_ID,price_id:PRICE_ID,sku:SKU,amount_minor:AMOUNT_MINOR,currency:"nzd"}};
 }catch{return {ok:false,config,db_ok:false,table_ok:false,remaining_units:null}}
}

Deno.serve(async req=>{
 if(req.method==="GET"){
   const h=await health();
   console.log("BILLBOARD_HEALTH",JSON.stringify(h));
   return json(h.ok?200:503,h);
 }
 if(req.method!=="POST")return json(405,{error:"Method not allowed"});
 if(!SUPABASE_URL||!SERVICE_ROLE_KEY||!STRIPE_SECRET_KEY||!WEBHOOK_SECRET)return json(503,{error:"Webhook configuration incomplete"});
 const raw=await req.text();
 if(!(await verify(raw,req.headers.get("stripe-signature")||"")))return json(400,{error:"Invalid Stripe signature"});
 let event:any;try{event=JSON.parse(raw)}catch{return json(400,{error:"Invalid JSON"})}
 if(event.livemode!==true)return json(200,{received:true,ignored:"test_mode_event"});
 if(event.type!=="checkout.session.completed")return json(200,{received:true,ignored:event.type});
 const s=event.data?.object||{},m=s.metadata||{};
 if(String(s.payment_link||"")!==PAYMENT_LINK_ID)return json(200,{received:true,ignored:"non_billboard_payment_link"});
 if(String(m.sku||"")!==SKU)return json(200,{received:true,ignored:"non_billboard_sku"});
 if(String(s.payment_status||"")!=="paid")return json(200,{received:true,ignored:"not_paid"});
 if(String(s.currency||"").toLowerCase()!=="nzd"||Number(s.amount_total)!==AMOUNT_MINOR)return json(400,{error:"Unexpected payment amount or currency"});

 const lr=await stripe("checkout/sessions/"+encodeURIComponent(String(s.id))+"/line_items?limit=100");
 if(!lr.ok)return json(502,{error:"Could not retrieve Stripe line items"});
 const li=await lr.json(),prices=(li.data||[]).map((i:any)=>String(i.price?.id||""));
 if(!prices.includes(PRICE_ID))return json(400,{error:"Canonical billboard price missing"});

 const label=field(s,"tile_alt_text").slice(0,120);
 const destination=field(s,"destination_url");
 const image=field(s,"tile_image_url");
 const email=String(s.customer_details?.email||s.customer_email||"").trim()||null;
 if(!label||!validHttps(destination)){
   const refunded=await refund(String(s.payment_intent||""),"invalid_billboard_intake");
   return json(refunded?200:500,{received:true,refunded,reason:"Required billboard intake was invalid"});
 }
 if(image&&!validHttps(image)){
   const refunded=await refund(String(s.payment_intent||""),"invalid_billboard_image_url");
   return json(refunded?200:500,{received:true,refunded,reason:"Optional billboard image URL was invalid"});
 }

 const existing=await db("billboard_campaigns?stripe_session_id=eq."+encodeURIComponent(String(s.id))+"&select=campaign_id,status,x,y,width,height&limit=1");
 if(!existing.ok)return json(503,{error:"Billboard idempotency lookup failed"});
 const already=await existing.json();
 if(already.length)return json(200,{received:true,billboard:true,idempotent:true,fulfillment:already[0]});

 const inv=await db("billboard_campaigns?market=eq."+MARKET+"&status=in.("+ACTIVE_STATUSES.join(",")+")&select=campaign_id,x,y,width,height,status&limit=100");
 if(!inv.ok)return json(503,{error:"Billboard inventory unavailable"});
 const rows=await inv.json(),slot=findFree(rows);
 if(!slot){
   const refunded=await refund(String(s.payment_intent||""),"billboard_sold_out");
   return json(refunded?200:500,{received:true,refunded,reason:"Billboard sold out"});
 }

 const hashBytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(label+"\n"+destination+"\n"+image));
 const contentHash=Array.from(new Uint8Array(hashBytes),b=>b.toString(16).padStart(2,"0")).join("");
 const campaign={
   campaign_id:"BB-"+String(s.id).replace(/[^A-Za-z0-9_-]/g,"").slice(-24),
   market:MARKET,x:slot.x,y:slot.y,width:WIDTH,height:HEIGHT,price_nzd:PRICE_NZD,
   owner_email:email,image_url:image||null,destination_url:destination,content_hash:contentHash,
   stripe_session_id:String(s.id),status:"PAID_PENDING_REVIEW",purchased_at:new Date().toISOString(),title:label
 };
 const ins=await db("billboard_campaigns",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=representation"},body:JSON.stringify(campaign)});
 if(!ins.ok){
   const reason=await ins.text();
   const refunded=await refund(String(s.payment_intent||""),"billboard_reservation_failed");
   console.error("BILLBOARD_RESERVATION_FAILED",JSON.stringify({session_id:s.id,refunded,reason:reason.slice(0,500)}));
   return json(refunded?200:500,{received:true,refunded,reason:"Billboard payment could not be safely reserved"});
 }
 const inserted=await ins.json();
 return json(200,{received:true,billboard:true,fulfillment:inserted?.[0]||{...campaign,owner_email:undefined}});
});
