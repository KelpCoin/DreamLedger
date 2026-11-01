'use strict';
// BECK ad checkout candidate: NOT LIVE. Requires three explicit release controls.
const crypto=require('node:crypto');
const {inventory}=require('./BeckAdInventoryRead');
const {reserve,lookupReservation}=require('./BeckAdReservationClient');
const {bindCheckout}=require('./BeckAdCheckoutBinding');
const RELEASE=['BECK_AD_CHECKOUT_ENABLED','BECK_AD_OWNER_RELEASE_APPROVED','BECK_AD_WEBHOOK_DELIVERY_READY'];
const ID='BECK-AD-FOUNDING-100X100';
const FIXED_START='2026-11-01T00:00:00Z';
const FIXED_END='3000-01-01T00:00:00Z';
function error(message,statusCode=503){return Object.assign(new Error(message),{statusCode})}
function releaseEnabled(env){return RELEASE.every(x=>env[x]==='true')}
function parseInput(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw error('invalid_checkout_request',400);
  if(value.market!=='NZ'||value.size!=='small')throw error('unavailable_product',422);
  const title=String(value.title||'').trim();
  const email=String(value.email||'').trim().toLowerCase();
  const requestKey=String(value.request_key||'');
  if(!title||title.length>80||/[\x00-\x1f]/.test(title))throw error('invalid_title',400);
  if(email.length>180||!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))throw error('invalid_email',400);
  if(!/^[A-Za-z0-9_-]{20,96}$/.test(requestKey))throw error('invalid_idempotency_key',400);
  let url;try{url=new URL(String(value.destination_url||''))}catch{throw error('invalid_destination',400)}
  const host=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||url.username||url.password||url.href.length>500||
     host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||
     /^\d+\.\d+\.\d+\.\d+$/.test(host)||host.includes(':')||!host.includes('.'))
    throw error('invalid_destination',400);
  return {title,email,requestKey,destination_url:url.href};
}
function occupiedCells(placements){
  if(!Array.isArray(placements))throw error('inventory_unverified');
  const used=new Set();
  for(const p of placements){
    if(!p||![p.x,p.y,p.width,p.height].every(Number.isInteger)||
       p.x<0||p.y<0||p.width<=0||p.height<=0||p.x+p.width>1000||p.y+p.height>1000)
      throw error('inventory_unverified');
    for(let y=0;y<10;y++)for(let x=0;x<10;x++)
      if(x*100<p.x+p.width&&p.x<x*100+100&&y*100<p.y+p.height&&p.y<y*100+100)used.add(y*10+x);
  }
  return used;
}
async function prepareCheckout(value,{env=process.env,fetchImpl=globalThis.fetch,
    getInventory=inventory,makeReservation=reserve,findExisting=lookupReservation,bindReservation=bindCheckout,now=new Date()}={}){
  if(!releaseEnabled(env))throw error('checkout_disabled');
  if(!env.STRIPE_SECRET_KEY||!/^sk_(test|live)_/.test(env.STRIPE_SECRET_KEY))throw error('stripe_not_configured');
  const data=parseInput(value);
  if(!(now instanceof Date)||!Number.isFinite(now.valueOf())||typeof fetchImpl!=='function')throw error('checkout_clock_or_network_unavailable');
  const digest=crypto.createHash('sha256').update(data.requestKey+'|'+data.email+'|'+data.title+'|'+data.destination_url).digest('hex');
  const key='beck_'+digest.slice(0,60);
  const creativeSha256=crypto.createHash('sha256').update(JSON.stringify({
    title:data.title,destination_url:data.destination_url
  })).digest('hex');
  let hold;
  // First inspect a previous claim for the exact same logical request. Never
  // allocate a different spot simply because the original claim now occupies it.
  const previous=await findExisting({exhaust:'dreamledger',silo:'ads',
    canvas:'nz_board',idempotency_key:key},{env,fetchImpl});
  if(previous){
    if(previous.status!=='HELD'||previous.price_minor!==5000||previous.currency!=='NZD'||
       previous.width!==100||previous.height!==100||
       previous.canvas_width!==1000||previous.canvas_height!==1000||
       !Number.isInteger(previous.x)||!Number.isInteger(previous.y)||
       previous.x<0||previous.y<0||previous.x+100>1000||previous.y+100>1000||
       Date.parse(previous.campaign_start)!==Date.parse(FIXED_START)||
       Date.parse(previous.campaign_end)!==Date.parse(FIXED_END)||
       (previous.checkout_session_expires_at&&
        Date.parse(previous.checkout_session_expires_at)<=now.valueOf()+60000))
      throw error('reservation_replay_unavailable');
    hold={reservation_id:previous.reservation_id,status:previous.status,
      expires_at:previous.hold_expires_at};
  }else{
    const live=await getInventory({env,fetchImpl,now});
    if(live?.inventory_source!=='verified_registered_supabase'||live.market!=='NZ'||
       live.total_founding_units!==100||!Number.isInteger(live.remaining_founding_units)||
       live.remaining_founding_units<=0)throw error('verified_inventory_unavailable');
    const used=occupiedCells(live.unavailable_positions);
    if(100-used.size!==live.remaining_founding_units)throw error('inventory_count_conflict');
    const offset=parseInt(digest.slice(0,8),16)%100;
    // No session is created unless a single atomic reservation succeeds.
    for(let i=0;i<100;i++){
      const cell=(offset+i)%100;if(used.has(cell))continue;
      const x=(cell%10)*100,y=Math.floor(cell/10)*100;
      const placement={id:'nz_tile_'+cell,exhaust:'dreamledger',silo:'ads',canvas_id:'nz_board',
        x,y,width:100,height:100,canvas_width:1000,canvas_height:1000,
        price_minor:5000,currency:'NZD',status:'APPROVED',
        start_utc:FIXED_START,end_utc:FIXED_END};
      try{
        hold=await makeReservation({placement,idempotency_key:key},{env,fetchImpl});
        break;
      }catch(e){
        if(e?.message==='beck_ad_inventory_conflict'){used.add(cell);continue}
        throw error('reservation_unavailable');
      }
    }
  }
  if(!hold?.reservation_id||hold.status!=='HELD'||Date.parse(hold.expires_at)<=now.valueOf()+35*60*1000)
    throw error('reservation_unavailable');
  const expiresAt=Math.floor(now.valueOf()/1000)+30*60;
  const publicBase='https://dreamledger.org';
  const form=new URLSearchParams({
    mode:'payment',customer_email:data.email,
    success_url:publicBase+'/billboard?checkout=returned&session_id={CHECKOUT_SESSION_ID}',
    cancel_url:publicBase+'/billboard?checkout=cancelled',
    expires_at:String(expiresAt),
    'line_items[0][price_data][currency]':'nzd',
    'line_items[0][price_data][unit_amount]':'5000',
    'line_items[0][price_data][product_data][name]':'BECK Internet Billboard Founding Tile',
    'line_items[0][quantity]':'1',
    'metadata[product_sku]':ID,'metadata[product_id]':ID,
    'metadata[offer_id]':ID,'metadata[silo]':'ads','metadata[source]':'beck_ad_reserved_checkout',
    'metadata[reservation_id]':hold.reservation_id,
    'metadata[creative_sha256]':creativeSha256,
    'metadata[review_status]':'APPROVAL_REQUIRED',
    'payment_intent_data[metadata][product_sku]':ID,
    'payment_intent_data[metadata][product_id]':ID,
    'payment_intent_data[metadata][offer_id]':ID,
    'payment_intent_data[metadata][silo]':'ads',
    'payment_intent_data[metadata][source]':'beck_ad_reserved_checkout',
    'payment_intent_data[metadata][reservation_id]':hold.reservation_id,
    'payment_intent_data[metadata][creative_sha256]':creativeSha256
  });
  let res;try{
    res=await fetchImpl('https://api.stripe.com/v1/checkout/sessions',{
      method:'POST',headers:{authorization:'Bearer '+env.STRIPE_SECRET_KEY,
        'content-type':'application/x-www-form-urlencoded',
        'idempotency-key':'beck-ad-'+digest},
      body:form,signal:AbortSignal.timeout(10000)});
  }catch{throw error('checkout_provider_unavailable')}
  if(!res?.ok)throw error('checkout_provider_rejected');
  let session;try{session=await res.json()}catch{throw error('checkout_provider_invalid')}
  // The provider must attest the exact sellable contract before any checkout
  // URL is returned. A merely well-formed cs_* ID could be a different price,
  // inventory reservation, merchant mode or creative, leaving an orphan payment.
  const expectedLive=env.STRIPE_SECRET_KEY.startsWith('sk_live_');
  const expectedPrefix=expectedLive?'cs_live_':'cs_test_';
  const metadataKeys=['product_sku','product_id','offer_id','silo','source',
    'reservation_id','creative_sha256','review_status'];
  if(!session||typeof session.id!=='string'||!session.id.startsWith(expectedPrefix)||
     !/^cs_(test|live)_[A-Za-z0-9_]+$/.test(session.id)||
     typeof session.url!=='string'||!session.url.startsWith('https://checkout.stripe.com/')||
     session.livemode!==expectedLive||session.mode!=='payment'||session.status!=='open'||
     session.payment_status!=='unpaid'||session.amount_total!==5000||
     session.currency!=='nzd'||session.expires_at!==expiresAt||
     metadataKeys.some(k=>session.metadata?.[k]!==form.get('metadata['+k+']')))
    throw error('checkout_provider_invalid');
  // Stripe session must be durably linked to the held position before the URL leaves the server.
  // If binding fails, attempt to expire the orphan Checkout Session (no charge performed).
  try{
    const linked=await bindReservation({
      reservation_id:hold.reservation_id,session_id:session.id,
      expires_at:new Date(expiresAt*1000).toISOString(),
      title:data.title,destination_url:data.destination_url,creative_sha256:creativeSha256
    },{env,fetchImpl});
    if(linked?.linked!==true||linked.checkout_session_id!==session.id||
       linked.reservation_id!==hold.reservation_id)throw error('checkout_binding_unverified');
  }catch{
    try{
      await fetchImpl('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(session.id)+'/expire',{
        method:'POST',headers:{authorization:'Bearer '+env.STRIPE_SECRET_KEY,
          'content-type':'application/x-www-form-urlencoded'},
        signal:AbortSignal.timeout(5000)});
    }catch{}
    throw error('checkout_binding_unverified');
  }
  return {checkout_url:session.url,session_id:session.id,reservation_id:hold.reservation_id,
    payment_verified:false,delivery_verified:false,publication:'APPROVAL_REQUIRED',expires_at:new Date(expiresAt*1000).toISOString()};
}
module.exports={prepareCheckout,parseInput,releaseEnabled,occupiedCells};
