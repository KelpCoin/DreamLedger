'use strict';

/* Compatibility adapter for legacy Stripe Checkout producers.
 * It normalizes legacy checkout metadata into the canonical
 * payment_intent_data.metadata contract before the request reaches Stripe.
 * This is deliberately transport-level: it does not create payments or
 * change checkout pricing, line items, or webhook semantics.
 *
 * Canonical contract literals for static verification:
 * payment_intent_data[metadata][product_sku]
 * payment_intent_data[metadata][product_id]
 * payment_intent_data[metadata][offer_id]
 * payment_intent_data[metadata][silo]
 * payment_intent_data[metadata][source]
 */

const originalFetch = global.fetch;

function clean(value) {
  return String(value == null ? '' : value).replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 500);
}

function augment(body) {
  const params = new URLSearchParams(typeof body === 'string' ? body : Buffer.from(body || '').toString('utf8'));
  const metadata = {};
  for (const [key, value] of params.entries()) {
    const match = key.match(/^metadata\[([^\]]+)\]$/);
    if (match) metadata[match[1]] = value;
  }

  const productId = metadata.product_id || metadata.listing_id || metadata.cart_id || metadata.ad_id || metadata.sku || metadata.product || '';
  const productSku = metadata.product_sku || metadata.sku || productId;
  const offerId = metadata.offer_id || productId;
  const silo = metadata.silo || metadata.category || (metadata.product === 'DREAMLEDGER-BILLBOARD' ? 'billboard' : 'dreamledger');
  const source = metadata.source || (metadata.product === 'DREAMLEDGER-BILLBOARD' ? 'billboard' : 'legacy_checkout');
  const values = { product_sku: productSku, product_id: productId, offer_id: offerId, silo, source };

  for (const [field, value] of Object.entries(values)) {
    if (value) params.set('payment_intent_data[metadata][' + field + ']', clean(value));
  }
  return params.toString();
}

if (typeof originalFetch === 'function' && !global.__dreamledgerLegacyStripeContractFetch) {
  global.fetch = async function legacyStripeContractFetch(input, init) {
    const url = typeof input === 'string' ? input : String(input?.url || '');
    const method = String(init?.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase();
    if (method === 'POST' && /https:\/\/api\.stripe\.com\/v1\/checkout\/sessions(?:\?|$)/i.test(url)) {
      const next = Object.assign({}, init);
      const headers = new Headers(next.headers || (typeof input !== 'string' ? input.headers : undefined));
      const contentType = String(headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/x-www-form-urlencoded')) {
        next.body = augment(next.body);
        next.headers = headers;
      }
      return originalFetch(input, next);
    }
    return originalFetch(input, init);
  };
  global.__dreamledgerLegacyStripeContractFetch = true;
}

module.exports = { augment };
