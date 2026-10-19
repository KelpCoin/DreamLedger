'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const VERIFIED = 'VERIFIED';

function json(res, status, body) {
  if (res.writableEnded) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

function handleBuyRoute(req, res, pathname, root = __dirname) {
  if (pathname !== '/buy' && !pathname.startsWith('/buy/')) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    return true;
  }

  const raw = pathname === '/buy' ? '' : pathname.slice('/buy/'.length);
  if (!raw || raw.includes('/')) {
    json(res, 404, { error: 'OFFER_NOT_FOUND' });
    return true;
  }

  let lookup;
  try { lookup = decodeURIComponent(raw).trim().toUpperCase(); }
  catch {
    json(res, 400, { error: 'INVALID_OFFER_ID' });
    return true;
  }
  if (!/^[A-Z0-9][A-Z0-9_-]{0,127}$/.test(lookup)) {
    json(res, 400, { error: 'INVALID_OFFER_ID' });
    return true;
  }

  let catalogue;
  try {
    catalogue = JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
  } catch {
    json(res, 503, { error: 'CATALOG_UNAVAILABLE' });
    return true;
  }

  const products = Array.isArray(catalogue.products) ? catalogue.products : [];
  const product = products.find(item =>
    item &&
    (String(item.id || '').trim().toUpperCase() === lookup ||
     String(item.sku || '').trim().toUpperCase() === lookup)
  );
  if (!product) {
    json(res, 404, { error: 'OFFER_NOT_FOUND' });
    return true;
  }

  // Fail closed unless checkout, the live Stripe link, and post-payment
  // fulfillment have each been explicitly verified in the canonical record.
  const paymentLinkState = String(product.payment_link_status || '').trim().toUpperCase();
  const checkoutEvidenceState = String(product.checkout_verification_status || '').trim().toUpperCase();
  const fulfillmentEvidenceState = String(product.fulfillment_test_status || product.delivery_test_status || '').trim().toUpperCase();
  const checkoutUrl = String(product.checkout_url || '').trim();

  if (product.status !== 'published' || product.checkout_available !== true ||
      paymentLinkState !== 'ACTIVE' || checkoutEvidenceState !== VERIFIED ||
      fulfillmentEvidenceState !== VERIFIED || !checkoutUrl) {
    json(res, 503, {
      error: 'OFFER_COMMERCE_GATE_CLOSED',
      offer_id: String(product.id || lookup),
      reason: 'Live payment-link state, checkout verification, and fulfillment verification are all required before purchase.'
    });
    return true;
  }

  let target;
  try { target = new URL(checkoutUrl); }
  catch {
    json(res, 503, { error: 'INVALID_CHECKOUT_CONFIGURATION', offer_id: String(product.id || lookup) });
    return true;
  }
  if (target.protocol !== 'https:' || target.hostname !== 'buy.stripe.com' ||
      target.username || target.password || target.port) {
    json(res, 503, { error: 'INVALID_CHECKOUT_CONFIGURATION', offer_id: String(product.id || lookup) });
    return true;
  }

  res.statusCode = 302;
  res.setHeader('Location', target.href);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(req.method === 'HEAD' ? undefined : 'Redirecting to verified Stripe Checkout.');
  return true;
}

module.exports = { handleBuyRoute };
