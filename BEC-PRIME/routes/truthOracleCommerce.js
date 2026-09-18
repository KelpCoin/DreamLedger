function plans() { return read(PRICING).plans || []; }
function paidPlan(tier) { return plans().find(p => p.tier === tier && Number(p.price_nzd_month) > 0 && p.stripe_price_id) || null; }
function getCookie(req,name) { const raw=String(req.headers.cookie||''); const match=raw.match(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)')); return match ? decodeURIComponent(match[1]) : null; }
function currentUser(req) { const sessionId=getCookie(req,COOKIE); if(!sessionId)return null; try { const users=read(path.join(DATA_ROOT,'users.json')); return Array.isArray(users) ? users.find(u => u.id===sessionId && u.email) || null : null; } catch { return null; } }
function billing() { try { const state=read(BILLING_STATE); return state && typeof state==='object' ? state : {}; } catch { return {}; } }
function saveBilling(state) { write(BILLING_STATE,state); }
function getEntitlement(userId) {
  const record=billing()[userId];
  if(!record || record.environment!=='live' || record.status!=='active') return {tier:'public',expires_at:null};
  if(record.expires_at && Date.parse(record.expires_at) <= Date.now()) return {tier:'public',expires_at:record.expires_at};
  return {tier:record.tier || 'public',expires_at:record.expires_at || null};
}
async function stripeGet(endpoint) {
  if(!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  const response=await fetch('https://api.stripe.com/v1/'+endpoint,{headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY}});
  const text=await response.text(); let data; try{data=JSON.parse(text);}catch{data={raw:text};}
  if(!response.ok)throw new Error(data?.error?.message||'Stripe API '+response.status); return data;
}
async function stripePost(endpoint,params,idempotencyKey) {
  if(!STRIPE_SECRET_KEY)throw new Error('STRIPE_SECRET_KEY is not configured');
  const response=await fetch('https://api.stripe.com/v1/'+endpoint,{method:'POST',headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':idempotencyKey},body:form(params)});
  const text=await response.text(); let data; try{data=JSON.parse(text);}catch{data={raw:text};}
  if(!response.ok)throw new Error(data?.error?.message||'Stripe API '+response.status); return data;
}
function isoFromUnix(value) { return Number.isFinite(Number(value)) ? new Date(Number(value)*1000).toISOString() : null; }
function rememberEvent(record,event) { const events={...(record.provider_events||{})}; events[event.id]={type:event.type,timestamp:event.created||null,livemode:event.livemode===true,processed_at:new Date().toISOString()}; const ids=Object.keys(events); while(ids.length>100){delete events[ids.shift()];} record.provider_events=events; record.last_provider_event_id=event.id; return record; }

async function handle(req,res,url) {
  if(req.method==='GET'&&url==='/api/truth-oracle/plans') return send(res,200,{plans:plans().map(p=>({tier:p.tier,display_name:p.display_name||p.tier,price_nzd_month:Number(p.price_nzd_month),disclosure_class:p.disclosure_class,description:p.description}))});
  if(req.method==='GET'&&url==='/api/truth-oracle/entitlement') {
    const user=currentUser(req); if(!user)return send(res,401,{error:'authentication_required'});
    return send(res,200,{entitlement:getEntitlement(user.id),truth_unchanged:true});
  }
  if(req.method==='POST'&&url==='/api/truth-oracle/checkout') {
    const user=currentUser(req); if(!user)return send(res,401,{error:'authentication_required'});
    let raw=''; for await(const chunk of req){raw+=chunk;if(raw.length>20000)return send(res,413,{error:'Request too large'});}
    let body={};try{body=JSON.parse(raw||'{}');}catch{return send(res,400,{error:'Invalid JSON'});}
    const plan=paidPlan(String(body.tier||'')); if(!plan)return send(res,400,{error:'Unknown or unavailable Truth Oracle tier'});
    const productSku='TRUTH-ORACLE-'+String(plan.tier).toUpperCase();
    const offerId='OFFER-TRUTH-ORACLE-'+String(plan.tier).toUpperCase();
    try {
      const session=await stripePost('checkout/sessions',{
        mode:'subscription',
        client_reference_id:user.id,
        'line_items[0][price]':plan.stripe_price_id,
        'line_items[0][quantity]':'1',
        customer_email:user.email,
        success_url:PUBLIC_BASE+'/truth-oracle?checkout=success&session_id={CHECKOUT_SESSION_ID}',
        cancel_url:PUBLIC_BASE+'/truth-oracle?checkout=cancelled',
        allow_promotion_codes:'true',
        'metadata[product_sku]':productSku,
        'metadata[product_id]':productSku,
        'metadata[offer_id]':offerId,
        'metadata[silo]':'truth-oracle',
        'metadata[source]':'truth-oracle',
        'metadata[user_id]':user.id,
        'metadata[truth_oracle_tier]':plan.tier,
        'metadata[disclosure_class]':plan.disclosure_class,
        'subscription_data[metadata][product_sku]':productSku,
        'subscription_data[metadata][product_id]':productSku,
        'subscription_data[metadata][offer_id]':offerId,
        'subscription_data[metadata][silo]':'truth-oracle',
        'subscription_data[metadata][source]':'truth-oracle',
        'subscription_data[metadata][user_id]':user.id,
        'subscription_data[metadata][truth_oracle_tier]':plan.tier,
        'subscription_data[metadata][disclosure_class]':plan.disclosure_class
      },'dreamledger-truth-checkout-'+user.id+'-'+plan.tier+'-'+crypto.randomUUID());
      return send(res,200,{ok:true,tier:plan.tier,session_id:session.id,checkout_url:session.url});
    }catch(err){return send(res,502,{error:err.message});}
  }
  if(req.method==='GET'&&url==='/api/truth-oracle/access') {
    const user=currentUser(req); if(!user)return send(res,401,{error:'authentication_required'});
    const entitlement=getEntitlement(user.id); return send(res,200,{authenticated:true,entitled:entitlement.tier!=='public',tier:entitlement.tier,expires_at:entitlement.expires_at,truth_unchanged:true});
  }
  return false;
}

async function handleStripeWebhook(raw,signature) {
  stripeProof.verifyStripeSignature(raw,signature,process.env.STRIPE_WEBHOOK_SECRET||'');
  let event; try{event=JSON.parse(raw);}catch{throw Object.assign(new Error('Invalid JSON payload'),{statusCode:400});}
  const object=event?.data?.object||{};
  const metadata={...(object.metadata||{})};
  const subscriptionId=typeof object.subscription==='string'?object.subscription:(object.subscription?.id||null);
  let subscription=null;
  if((event.type==='invoice.paid'||event.type==='invoice.payment_failed') && subscriptionId && STRIPE_SECRET_KEY) subscription=await stripeGet('subscriptions/'+encodeURIComponent(subscriptionId));
  if(metadata.silo!=='truth-oracle' && subscription?.metadata?.silo!=='truth-oracle')return {handled:false};
  const environment=event.livemode===true?'live':'test';
  const state=billing();
  let userId=String(metadata.user_id||object.client_reference_id||subscription?.metadata?.user_id||'');
  if(!userId && subscriptionId && STRIPE_SECRET_KEY) {
    const resolved=subscription || await stripeGet('subscriptions/'+encodeURIComponent(subscriptionId));
    userId=String(resolved.metadata?.user_id||'');
  }
  if(!userId)throw Object.assign(new Error('Truth Oracle billing event missing account association'),{statusCode:400});
  const existing=state[userId]||{};
  if(existing.provider_events && existing.provider_events[event.id]) return {handled:true,idempotent:true,provider_event_id:event.id};
  let record={...existing};
  if(event.type==='checkout.session.completed') {
    if(object.mode!=='subscription'||object.payment_status!=='paid')return {handled:true,ignored:true,reason:'payment_not_paid'};
    const tier=String(metadata.truth_oracle_tier||''); if(!paidPlan(tier))throw Object.assign(new Error('Unknown Truth Oracle tier in provider event'),{statusCode:400});
    if(!subscription && subscriptionId && STRIPE_SECRET_KEY) subscription=await stripeGet('subscriptions/'+encodeURIComponent(subscriptionId));
    record={...record,tier,status:'active',environment,customer_id:object.customer||null,subscription_id:subscriptionId,expires_at:isoFromUnix(subscription?.current_period_end),updated_at:new Date().toISOString()};
    record=rememberEvent(record,event); state[userId]=record; saveBilling(state); return {handled:true,economic_state:'ENTITLEMENT_GRANTED',provider_event_id:event.id,environment};
  }
  if(event.type==='invoice.paid') {
    const tier=String(metadata.truth_oracle_tier||subscription?.metadata?.truth_oracle_tier||existing.tier||'');
    if(!paidPlan(tier))return {handled:true,ignored:true,reason:'unknown_tier'};
    record={...record,tier,status:'active',environment,customer_id:object.customer||existing.customer_id,subscription_id:subscriptionId||existing.subscription_id,expires_at:isoFromUnix(subscription?.current_period_end),updated_at:new Date().toISOString()};
    record=rememberEvent(record,event); state[userId]=record; saveBilling(state); return {handled:true,economic_state:'PAYMENT_SUCCEEDED',provider_event_id:event.id,environment};
  }
  if(event.type==='invoice.payment_failed') {
    record={...record,status:'past_due',environment,updated_at:new Date().toISOString()}; record=rememberEvent(record,event); state[userId]=record; saveBilling(state); return {handled:true,economic_state:'PAYMENT_FAILED',provider_event_id:event.id,environment};
  }
  if(event.type==='customer.subscription.updated') {
    const tier=String(metadata.truth_oracle_tier||existing.tier||''); const status=String(object.status||''); const active=['active','trialing'].includes(status);
    record={...record,tier:paidPlan(tier)?tier:(existing.tier||'public'),status:active?'active':status,environment,customer_id:object.customer||existing.customer_id,subscription_id:object.id||existing.subscription_id,expires_at:isoFromUnix(object.current_period_end),cancel_at_period_end:object.cancel_at_period_end===true,updated_at:new Date().toISOString()};
    record=rememberEvent(record,event); state[userId]=record; saveBilling(state); return {handled:true,economic_state:active?'ENTITLEMENT_GRANTED':'BILLING_STATE_UPDATED',provider_event_id:event.id,environment};
  }
  if(event.type==='customer.subscription.deleted') {
    record={...record,status:'canceled',environment,subscription_id:object.id||existing.subscription_id,updated_at:new Date().toISOString(),expires_at:new Date().toISOString()}; record=rememberEvent(record,event); state[userId]=record; saveBilling(state); return {handled:true,economic_state:'REVOKED',provider_event_id:event.id,environment};
  }
  record=rememberEvent(record,event); state[userId]=record; saveBilling(state); return {handled:true,ignored:true,reason:'unsupported_event',provider_event_id:event.id,environment};
}

module.exports={handle,handleStripeWebhook,getEntitlement};