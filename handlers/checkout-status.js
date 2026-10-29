'use strict';
// Read-only Stripe Checkout verification. A return URL is NOT payment evidence.
// This route never settles an order, grants entitlement, or releases fulfilment.
function reply(status, data) {
  return new Response(JSON.stringify(data), {
    status, headers: {
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store, private',
      'referrer-policy':'no-referrer',
      'x-content-type-options':'nosniff'
    }
  });
}
async function checkoutStatus(request, options = {}) {
  if (request.method !== 'GET') return reply(405, { error:'METHOD_NOT_ALLOWED' });
  let id;
  try { id = new URL(request.url).searchParams.get('session_id') || ''; }
  catch { return reply(400, {error:'INVALID_URL'}); }
  if (!/^cs_[A-Za-z0-9_]{8,128}$/.test(id)) {
    return reply(400, {error:'INVALID_SESSION_ID'});
  }
  const secret = options.secret === undefined ? process.env.STRIPE_SECRET_KEY : options.secret;
  if (typeof secret !== 'string' || !secret) {
    return reply(503, {error:'PAYMENT_VERIFICATION_UNAVAILABLE'});
  }
  const fetcher = options.fetcher || globalThis.fetch;
  let upstream;
  try {
    upstream = await fetcher('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(id), {
      method:'GET', headers:{authorization:'Bearer ' + secret, accept:'application/json'},
      redirect:'error', signal:AbortSignal.timeout(8000)
    });
  } catch {
    return reply(503, {error:'PAYMENT_VERIFICATION_UNAVAILABLE'});
  }
  if (!upstream || !upstream.ok) {
    // Do not distinguish unknown checkout IDs from Stripe authorization failures to clients.
    return reply(503, {error:'PAYMENT_VERIFICATION_UNAVAILABLE'});
  }
  let session;
  try { session = await upstream.json(); }
  catch { return reply(503, {error:'PAYMENT_VERIFICATION_UNAVAILABLE'}); }
  if (!session || session.object !== 'checkout.session' || session.id !== id ||
      typeof session.livemode !== 'boolean' || typeof session.payment_status !== 'string' ||
      typeof session.status !== 'string') {
    return reply(503, {error:'PAYMENT_VERIFICATION_UNAVAILABLE'});
  }
  const paid = session.status === 'complete' && session.payment_status === 'paid';
  const diagnostic = String(session.metadata?.sku || session.metadata?.product_sku || '') ===
    'COMMANDER-DECK-DIAGNOSTIC-001';
  // No buyer email, customer identity, raw metadata, amount, or secret is returned.
  return reply(200, {
    verified:true, paid, test_mode:!session.livemode,
    state:paid ? 'PAID_REPORTED_BY_STRIPE' : 'NOT_PAID',
    next_step:paid && diagnostic ? 'DIAGNOSTIC_INPUT' : 'PRODUCT_FULFILMENT_PENDING',
    independent_settlement_verified:false, fulfilment_verified:false
  });
}
module.exports = checkoutStatus;
module.exports.checkoutStatus = checkoutStatus;
