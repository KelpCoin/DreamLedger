// Read-only checkout return status. Webhook/database remain the authority for entitlements.
const SKU='COMMANDER-DECK-DIAGNOSTIC-001';
const LOOKUP='COMMANDER_DECK_DIAGNOSTIC_001_NZD_29';
const LIVE_PRICE='price_1UFFY1EGgEAnUFF9Yq03zIa7';
const LIVE_PRODUCT='prod_V6iVKl9HgFpzRU';
const headers={'Cache-Control':'no-store, max-age=0','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const reply=(data,code=200)=>Response.json(data,{status:code,headers});
async function readJson(url,options){
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(6500),cache:'no-store'});
 if(!response.ok)throw Error('UPSTREAM_'+response.status);
 return response.json();
}
export default async function handler(request){
 if(request.method!=='GET')return reply({state:'method_not_allowed'},405);
 const id=new URL(request.url).searchParams.get('session_id')||'';
 if(!/^cs_(live|test)_[a-zA-Z0-9]{10,180}$/.test(id))return reply({state:'invalid_session'},400);
 const key=process.env.STRIPE_SECRET_KEY||process.env.STRIPE_API_KEY;
 if(!key)return reply({state:'verification_unavailable',retryable:true},503);
 const testMode=id.startsWith('cs_test_');
 if(testMode && process.env.VERCEL_ENV==='production')return reply({state:'invalid_session'},400);
 const expectedPrice=testMode?process.env.MTG_DIAGNOSTIC_TEST_PRICE_ID:LIVE_PRICE;
 if(!expectedPrice)return reply({state:'verification_unavailable',retryable:true},503);
 let session;
 try{
  const query=new URLSearchParams();
  query.append('expand[]','line_items.data.price.product');
  session=await readJson('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(id)+'?'+query,{headers:{Authorization:'Bearer '+key}});
 }catch{return reply({state:'verification_unavailable',retryable:true},503);}
 if(session.id!==id||session.livemode===testMode||session.mode!=='payment')return reply({state:'invalid_session'},400);
 if(session.status==='expired'||session.payment_status==='unpaid')return reply({state:'awaiting_payment',retryable:false});
 const items=session.line_items?.data;
 if(!Array.isArray(items)||session.line_items.has_more||items.length!==1)return reply({state:'product_mismatch'},409);
 const item=items[0],price=item.price,product=price?.product;
 if(!price||!product||typeof product!=='object')return reply({state:'product_mismatch'},409);
 const lookup=testMode?(process.env.MTG_DIAGNOSTIC_TEST_LOOKUP_KEY||LOOKUP):LOOKUP;
 const valid=price.id===expectedPrice&&price.lookup_key===lookup&&
  price.metadata?.dreamledger_sku===SKU&&product.metadata?.dreamledger_sku===SKU&&
  (testMode||product.id===LIVE_PRODUCT)&&price.unit_amount===2900&&price.currency==='nzd'&&
  item.quantity===1&&session.currency==='nzd'&&session.amount_subtotal===2900;
 if(!valid)return reply({state:'product_mismatch'},409);
 // No status from a URL parameter can create an order, payment or entitlement.
 if(session.payment_status!=='paid')return reply({state:'awaiting_payment',retryable:true});
 const url=process.env.SUPABASE_URL;
 const token=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!token)return reply({state:'paid_pending_record',retryable:true});
 try{
  const base=url.replace(/\/$/,'');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base))throw Error('CONFIG');
  const q=new URLSearchParams({select:'id,payment_status,listing_id',checkout_session_id:'eq.'+id,limit:'1'});
  const rows=await readJson(base+'/rest/v1/marketplace_orders?'+q.toString(),{headers:{apikey:token,Authorization:'Bearer '+token}});
  const matched=Array.isArray(rows)&&rows.some(x=>x.payment_status==='paid'&&x.listing_id===session.metadata?.marketplace_listing_id);
  if(!matched)return reply({state:'paid_pending_record',retryable:true});
  const f=new URLSearchParams({select:'fulfillment_id,status','metadata->>stripe_checkout_session_id':'eq.'+id,'metadata->>sku':'eq.'+SKU,limit:'1'});
  const fulfillment=await readJson(base+'/rest/v1/marketplace_fulfillments?'+f.toString(),{headers:{apikey:token,Authorization:'Bearer '+token}});
  if(!Array.isArray(fulfillment)||!fulfillment.some(x=>x.fulfillment_id))return reply({state:'paid_pending_record',retryable:true});
  return reply({state:'paid_recorded',retryable:false});
 }catch{return reply({state:'paid_pending_record',retryable:true});}
}
