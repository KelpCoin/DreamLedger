import { createHash } from 'node:crypto';
const { verifyStripeSignature } = require('./stripeWebhookSignature.js');

function respond(status:number, body:Record<string,unknown>) {
  return new Response(JSON.stringify(body), {
    status, headers:{'content-type':'application/json; charset=utf-8',
                     'cache-control':'no-store','x-content-type-options':'nosniff'}
  });
}

// This route accepts provider events only after HMAC verification against raw
// Stripe bytes. It does NOT establish external settled revenue or delivery.
// It does NOT call Stripe's refund/charge/payout API.
export default async function handler(request:Request):Promise<Response> {
  if (request.method !== 'POST') return respond(405,{error:'METHOD_NOT_ALLOWED'});
  const secret=process.env.STRIPE_WEBHOOK_SECRET;
  const connection=process.env.NEON_DATABASE_URL;
  if (!secret || !connection) return respond(503,{error:'WEBHOOK_NOT_CONFIGURED'});
  if (!String(request.headers.get('content-type')||'').toLowerCase().includes('application/json'))
    return respond(415,{error:'CONTENT_TYPE_REQUIRED'});
  let body:Buffer;
  try { body=Buffer.from(await request.arrayBuffer()); }
  catch { return respond(400,{error:'INVALID_BODY'}); }
  if (body.length===0 || body.length>1_048_576) return respond(413,{error:'INVALID_BODY_LENGTH'});
  const signature=request.headers.get('stripe-signature')||'';
  if (!verifyStripeSignature(body,signature,secret)) return respond(400,{error:'INVALID_STRIPE_SIGNATURE'});
  let event:any;
  try { event=JSON.parse(body.toString('utf8')); }
  catch { return respond(400,{error:'INVALID_JSON'}); }
  if (!event || !['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))
    return respond(200,{received:true,ignored:true});
  const session=event.data?.object;
  if (!session || session.object!=='checkout.session' || session.payment_status!=='paid')
    return respond(200,{received:true,ignored:true,payment_not_reported:true});
  const meta=session.metadata||{};
  const amount=Number(session.amount_total);
  const currency=String(session.currency||'').toUpperCase();
  const orderId=String(meta.order_id||('unmatched:'+String(session.id||'unknown'))).slice(0,128);
  const offerId=String(meta.offer_id||'unknown').slice(0,128);
  const silo=String(meta.silo||'unknown').slice(0,64);
  if (!/^evt_[A-Za-z0-9]{5,128}$/.test(String(event.id||'')) ||
      !/^cs_[A-Za-z0-9_]{8,128}$/.test(String(session.id||'')) ||
      !Number.isSafeInteger(amount) || amount<=0 || !/^[A-Z]{3}$/.test(currency) ||
      typeof event.livemode!=='boolean')
    return respond(400,{error:'INVALID_STRIPE_EVENT_ENVELOPE'});
  const digest=createHash('sha256').update(body).digest('hex');
  try {
    const {neon}=require('@neondatabase/serverless');
    const client=neon(connection);
    const rows:any[]=await client.query(
      'SELECT public.record_checkout_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) AS receipt',
      [String(event.id),String(event.type),digest,event.livemode,orderId,
       String(session.id),typeof session.payment_intent==='string'?session.payment_intent:null,
       amount,currency,offerId,silo]
    );
    const receipt=rows?.[0]?.receipt;
    if (!receipt || typeof receipt.state!=='string') throw new Error('INVALID_DATABASE_RECEIPT');
    return respond(200,{received:true,state:receipt.state,
      independent_settlement_verified:false,fulfillment_verified:false});
  } catch {
    // Allow Stripe's normal retry cycle when the durable inbox fails.
    return respond(503,{error:'EVENT_NOT_DURABLY_RECORDED'});
  }
}
