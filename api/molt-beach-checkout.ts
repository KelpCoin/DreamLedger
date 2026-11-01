// BECK Vercel-native checkout endpoint. STAGED and disabled by default.
// Unpaid Stripe Checkout Sessions are not economic events.
export default async function handler(request: Request): Promise<Response> {
  const h={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
  const send=(code:number,body:unknown)=>new Response(JSON.stringify(body),{status:code,headers:h});
  if(request.method!=='POST')return send(405,{error:'method_not_allowed'});
  const origin=request.headers.get('origin');
  if(origin!=='https://dreamledger.org'&&origin!=='https://www.dreamledger.org')
    return send(403,{error:'origin_not_authorized'});
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return send(415,{error:'json_required'});
  // Network, money and inventory mutation cannot occur unless all release gates are ON.
  if(process.env.BECK_AD_CHECKOUT_ENABLED!=='true'||
     process.env.BECK_AD_OWNER_RELEASE_APPROVED!=='true'||
     process.env.BECK_AD_WEBHOOK_DELIVERY_READY!=='true')
    return send(503,{error:'checkout_not_activated'});
  const contentLength=Number(request.headers.get('content-length')||0);
  if(!Number.isFinite(contentLength)||contentLength>8192)return send(413,{error:'request_too_large'});
  let requestBody:unknown;
  try {
    const raw=await request.text();
    if(Buffer.byteLength(raw,'utf8')>8192)return send(413,{error:'request_too_large'});
    requestBody=JSON.parse(raw);
  }catch{return send(400,{error:'invalid_json'})}
  try{
    const backend=await import('../BEC-PRIME/runtime/BeckAdCheckout.js');
    const fn=backend.prepareCheckout||backend.default?.prepareCheckout;
    if(typeof fn!=='function')return send(503,{error:'checkout_backend_unavailable'});
    const order=await fn(requestBody);
    if(!order||order.publication!=='APPROVAL_REQUIRED'||
       order.payment_verified!==false||order.delivery_verified!==false||
       typeof order.checkout_url!=='string'||
       !order.checkout_url.startsWith('https://checkout.stripe.com/'))
       return send(503,{error:'checkout_response_unverified'});
    return send(200,{checkout_url:order.checkout_url,session_id:order.session_id,
      reservation_id:order.reservation_id,payment_verified:false,delivery_verified:false,
      publication:'APPROVAL_REQUIRED',expires_at:order.expires_at});
  }catch{
    return send(503,{error:'verified_checkout_unavailable'});
  }
}
