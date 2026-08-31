const TOLERANCE=300;
const TEXT_TILE_OFFER='BILLBOARD-TEXT-TILE-001';
const TEXT_TILE_AMOUNT=5000;
function json(data:any,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}
function hex(b:ArrayBuffer){return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('')}
async function verify(payload:string,sig:string,secret:string){const parts=sig.split(',');const t=parts.find(x=>x.startsWith('t='));const vs=parts.filter(x=>x.startsWith('v1=')).map(x=>x.slice(3));if(!t||!vs.length)return false;const ts=Number(t.slice(2));if(!Number.isFinite(ts)||Math.abs(Math.floor(Date.now()/1000)-ts)>TOLERANCE)return false;const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const expected=hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${ts}.${payload}`)));return vs.some(v=>v.length===expected.length&&v.split('').every((c,i)=>c===expected[i]))}
async function refund(secret:string,paymentIntent:string){if(!paymentIntent)return false;const form=new URLSearchParams();form.set('payment_intent',paymentIntent);const r=await fetch('https://api.stripe.com/v1/refunds',{method:'POST',headers:{authorization:`Bearer ${secret}`,'content-type':'application/x-www-form-urlencoded'},body:form});return r.ok}
function customField(session:any,key:string){const f=Array.isArray(session.custom_fields)?session.custom_fields.find((x:any)=>x.key===key):null;return String(f?.text?.value||f?.numeric?.value||f?.dropdown?.value||'').trim()}
export default async function handler(request:Request){
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const secret=process.env.STRIPE_WEBHOOK_SECRET;if(!secret)return json({error:'Webhook configuration missing'},503);
 const sig=request.headers.get('stripe-signature');if(!sig)return json({error:'Missing Stripe signature'},400);
 const body=await request.text();if(!(await verify(body,sig,secret)))return json({error:'Invalid Stripe signature'},400);
 let event:any;try{event=JSON.parse(body)}catch{return json({error:'Invalid JSON'},400)};
 if(event.type!=='checkout.session.completed')return json({received:true,ignored:true});
 const s=event.data?.object;if(!s||s.payment_status!=='paid')return json({received:true,ignored:true});
 const offer=String(s.metadata?.offer_id||'');if(offer!==TEXT_TILE_OFFER)return json({received:true,ignored:true});
 if(s.currency!=='nzd'||Number(s.amount_total)!==TEXT_TILE_AMOUNT)return json({error:'Payment amount/currency contract failed'},400);
 const title=customField(s,'title');const destination_url=customField(s,'destination_url');
 if(!title||title.length>80)return json({error:'Invalid title'},400);
 let destination:any;try{destination=new URL(destination_url)}catch{return json({error:'Invalid destination URL'},400)}
 if(!['http:','https:'].includes(destination.protocol))return json({error:'Destination URL must use HTTP or HTTPS'},400);
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!base||!key)return json({error:'Supabase configuration missing'},503);
 const rpc=base.replace(/\/$/,'')+'/rest/v1/rpc/fulfill_billboard_text_tile';
 const payload={p_campaign_id:`MB-${event.id}`,p_market:'GLOBAL',p_title:title,p_destination_url:destination.href,p_owner_email:s.customer_details?.email||s.customer_email||null,p_stripe_session_id:s.id,p_stripe_payment_intent:s.payment_intent||null,p_price_nzd:50};
 const r=await fetch(rpc,{method:'POST',headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(payload)});
 if(!r.ok){const reason=await r.text();const refunded=await refund(process.env.STRIPE_SECRET_KEY||'',s.payment_intent||'');console.error('BILLBOARD_TEXT_FULFILLMENT_FAILED',JSON.stringify({event_id:event.id,session_id:s.id,reason,refunded}));return json({received:true,refunded,reason:'Automatic fulfillment failed; captured payment was sent for refund.'},200)}
 const result=await r.json();
 const proof={event_id:event.id,event_type:event.type,checkout_session_id:s.id,payment_status:s.payment_status,amount_total:Number(s.amount_total),currency:s.currency,sku:TEXT_TILE_OFFER,paid_at:new Date((s.created||Math.floor(Date.now()/1000))*1000).toISOString(),fulfilment_status:'FULFILLED',fulfillment:result};
 await fetch(base.replace(/\/$/,'')+'/rest/v1/first_payment_proofs',{method:'POST',headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json','prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(proof)});
 console.log('BILLBOARD_TEXT_FULFILLED',JSON.stringify(proof));
 return json({received:true,offer_id:TEXT_TILE_OFFER,status:'FULFILLED',fulfillment:result});
}
