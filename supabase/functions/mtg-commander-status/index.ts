// Public read-only checkout status. Payment and entitlement authority remain Stripe/webhook.
const SKU='COMMANDER-DECK-DIAGNOSTIC-001';
const LOOKUP='COMMANDER-DECK-DIAGNOSTIC-001';
const LIVE_PRICE='price_1UFFY1EGgEAnUFF9Yq03zIa7';
const LIVE_PRODUCT='prod_V6iVKl9HgFpzRU';
const ORIGINS=['https://dreamledger.org','https://www.dreamledger.org'];
function output(state,status,origin,extra={}){
 const h={'content-type':'application/json; charset=utf-8','cache-control':'no-store, max-age=0','x-content-type-options':'nosniff','vary':'Origin'};
 if(ORIGINS.includes(origin))h['access-control-allow-origin']=origin;
 return new Response(JSON.stringify({state,...extra}),{status,headers:h});
}
async function json(url,headers){
 const r=await fetch(url,{method:'GET',headers,cache:'no-store',signal:AbortSignal.timeout(6500)});
 if(!r.ok)throw Error('UPSTREAM_'+r.status);
 return r.json();
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(!ORIGINS.includes(origin))return output('origin_denied',403,origin);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type,accept','access-control-max-age':'600','vary':'Origin'}});
 if(req.method!=='GET')return output('method_not_allowed',405,origin);
 const id=new URL(req.url).searchParams.get('session_id')||'';
 if(!/^cs_(live|test)_[A-Za-z0-9]{10,180}$/.test(id))return output('invalid_session',400,origin);
 const testMode=id.startsWith('cs_test_');
 const key=testMode?Deno.env.get('STRIPE_TEST_SECRET_KEY'):(Deno.env.get('STRIPE_API_KEY')||Deno.env.get('STRIPE_SECRET_KEY'));
 const expectedPrice=testMode?Deno.env.get('MTG_DIAGNOSTIC_TEST_PRICE_ID'):LIVE_PRICE;
 if(!key||!expectedPrice)return output('verification_unavailable',503,origin,{retryable:true});
 let s;
 try{
  const q=new URLSearchParams();q.append('expand[]','line_items.data.price.product');
  s=await json('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(id)+'?'+q,{Authorization:'Bearer '+key});
 }catch{return output('verification_unavailable',503,origin,{retryable:true});}
 if(s.id!==id||s.livemode===testMode||s.mode!=='payment')return output('invalid_session',400,origin);
 if(s.status==='expired'||s.payment_status==='unpaid')return output('awaiting_payment',200,origin,{retryable:false});
 const lines=s.line_items?.data;
 if(!Array.isArray(lines)||s.line_items.has_more||lines.length!==1)return output('product_mismatch',409,origin);
 const line=lines[0],p=line.price,product=p?.product;
 const lookup=testMode?(Deno.env.get('MTG_DIAGNOSTIC_TEST_LOOKUP_KEY')||LOOKUP):LOOKUP;
 const match=!!p&&!!product&&typeof product==='object'&&p.id===expectedPrice&&p.lookup_key===lookup&&
 p.metadata?.dreamledger_sku===SKU&&product.metadata?.dreamledger_sku===SKU&&s.metadata?.sku_id===SKU&&
 (testMode||product.id===LIVE_PRODUCT)&&p.unit_amount===2900&&p.currency==='nzd'&&
 line.quantity===1&&s.currency==='nzd'&&s.amount_subtotal===2900;
 if(!match)return output('product_mismatch',409,origin);
 if(s.payment_status!=='paid')return output('awaiting_payment',200,origin,{retryable:true});
 const url=Deno.env.get('SUPABASE_URL')||'',role=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)||!role)return output('paid_pending_record',200,origin,{retryable:true});
 try{
  const root=url.replace(/\/$/,'');
  const headers={'apikey':role,'Authorization':'Bearer '+role};
  const q=new URLSearchParams({select:'id,payment_status,listing_id',checkout_session_id:'eq.'+id,limit:'1'});
  const orders=await json(root+'/rest/v1/marketplace_orders?'+q,headers);
  if(!Array.isArray(orders)||!orders.some(o=>o.payment_status==='paid'&&o.listing_id===s.metadata?.marketplace_listing_id))return output('paid_pending_record',200,origin,{retryable:true});
  const fq=new URLSearchParams({select:'fulfillment_id,status','metadata->>stripe_checkout_session_id':'eq.'+id,'metadata->>sku':'eq.'+SKU,limit:'1'});
  const fulfil=await json(root+'/rest/v1/marketplace_fulfillments?'+fq,headers);
  if(!Array.isArray(fulfil)||!fulfil.some(f=>f.fulfillment_id&&f.status!=='failed'&&f.status!=='refunded'))return output('paid_pending_record',200,origin,{retryable:true});
  return output('paid_recorded',200,origin,{retryable:false});
 }catch{return output('paid_pending_record',200,origin,{retryable:true});}
});
