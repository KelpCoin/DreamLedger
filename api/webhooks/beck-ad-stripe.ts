// BECK native Stripe webhook for Vercel. Draft only, never auto-publishes.
// Requires verified Stripe signature, independent Stripe read, and locked DB receipt.
export default async function handler(request: Request): Promise<Response> {
  const h={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
  const send=(code:number,body:unknown)=>new Response(JSON.stringify(body),{status:code,headers:h});
  if(request.method!=='POST')return send(405,{error:'method_not_allowed'});
  if(process.env.BECK_AD_WEBHOOK_ENABLED!=='true'||
     process.env.BECK_AD_OWNER_RELEASE_APPROVED!=='true')
     return send(503,{error:'ad_webhook_not_activated'});
  const len=Number(request.headers.get('content-length')||0);
  if(!Number.isFinite(len)||len>65536)return send(413,{error:'request_too_large'});
  const signature=request.headers.get('stripe-signature')||'';
  if(!signature)return send(400,{error:'stripe_signature_required'});
  try {
    const raw=Buffer.from(await request.arrayBuffer());
    if(raw.length>65536)return send(413,{error:'request_too_large'});
    const backend=await import('../../BEC-PRIME/runtime/BeckAdPaymentWebhook.js');
    const fn=backend.processStripeEvent||backend.default?.processStripeEvent;
    if(typeof fn!=='function')return send(503,{error:'webhook_backend_unavailable'});
    const result=await fn(raw,signature);
    return send(200,result);
  }catch(e:any){
    return send(e?.statusCode===400?400:503,{
      error:e?.statusCode===400?'invalid_signed_stripe_event':'payment_evidence_unavailable'});
  }
}
