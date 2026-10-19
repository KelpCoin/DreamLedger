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

function isCheckoutReady(product) {
  if (!product || product.status !== 'published' || product.checkout_available !== true) return false;
  if (String(product.payment_link_status || '').trim().toUpperCase() !== 'ACTIVE') return false;
  if (String(product.checkout_verification_status || '').trim().toUpperCase() !== VERIFIED) return false;
  if (String(product.fulfillment_test_status || product.delivery_test_status || '').trim().toUpperCase() !== VERIFIED) return false;

  let target;
  try { target = new URL(String(product.checkout_url || '').trim()); }
  catch { return false; }
  return target.protocol === 'https:' && target.hostname === 'buy.stripe.com' &&
    !target.username && !target.password && !target.port;
}

function publicSafeProduct(product) {
  const safe = { ...product };
  if (!isCheckoutReady(product)) {
    safe.checkout_available = false;
    safe.checkout_url = null;
    safe.checkout_status = 'temporarily_unavailable';
  }
  delete safe.payment_link_status;
  delete safe.checkout_verification_status;
  delete safe.fulfillment_test_status;
  delete safe.delivery_test_status;
  return safe;
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
  const checkoutUrl = String(product.checkout_url || '').trim();
  if (!isCheckoutReady(product)) {
    json(res, 503, {
      error: 'OFFER_COMMERCE_GATE_CLOSED',
      offer_id: String(product.id || lookup),
      reason: 'Live payment-link state, checkout verification, and fulfillment verification are all required before purchase.'
    });
    return true;
  }

  const target = new URL(checkoutUrl);

  res.statusCode = 302;
  res.setHeader('Location', target.href);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(req.method === 'HEAD' ? undefined : 'Redirecting to verified Stripe Checkout.');
  return true;
}

module.exports = { handleBuyRoute, isCheckoutReady, publicSafeProduct };
