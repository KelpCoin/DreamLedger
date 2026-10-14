'use strict';

const CANONICAL_QR_URL = 'https://dreamledger.org/go?src=qr-canonical';
const CANONICAL_QR_ASSET = 'https://dreamledger.org/assets/qr-canonical.svg';

function safeToken(value, fallback, max = 80) {
  const cleaned = String(value == null ? '' : value).trim().replace(/[^A-Za-z0-9._-]/g, '-').slice(0, max);
  return cleaned || fallback;
}

function canonicalQrFulfillment({ productId, orderId, channel = 'fulfillment', campaign = 'buyer-referral' } = {}) {
  return {
    asset_id: 'QR-CANONICAL-001',
    canonical_url: CANONICAL_QR_URL,
    image_url: CANONICAL_QR_ASSET,
    product_id: safeToken(productId, 'unspecified-product'),
    order_reference: safeToken(orderId, 'unmatched-order'),
    channel: safeToken(channel, 'fulfillment'),
    campaign: safeToken(campaign, 'buyer-referral'),
    placement_policy: 'include_in_every_customer_facing_fulfillment',
    note: 'QR scans are acquisition events, not proof of a buyer, payment, revenue or fulfillment.'
  };
}

function customerQrHtml(context = {}) {
  const qr = canonicalQrFulfillment(context);
  return [
    '<section class="dreamledger-canonical-qr" aria-label="Share DreamLedger">',
    '<h2>Know someone who would find DreamLedger useful?</h2>',
    '<p>Scan the code to explore DreamLedger and share it with someone who may benefit.</p>',
    '<a href="' + CANONICAL_QR_URL + '" rel="noopener noreferrer">',
    '<img src="' + CANONICAL_QR_ASSET + '" alt="Scan to explore DreamLedger" width="220" height="220" loading="lazy">',
    '</a>',
    '<p><a href="' + CANONICAL_QR_URL + '">' + CANONICAL_QR_URL + '</a></p>',
    '</section>'
  ].join('');
}

function printableInsertHtml(context = {}) {
  const qr = canonicalQrFulfillment(context);
  return '<!doctype html><html lang="en-NZ"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>DreamLedger buyer insert</title><style>' +
    'body{font:16px/1.45 system-ui,sans-serif;color:#111;max-width:620px;margin:24px auto;padding:24px;text-align:center}' +
    'img{width:220px;height:220px;image-rendering:pixelated}.small{color:#444;font-size:12px}' +
    '@media print{body{margin:0;padding:10mm}.no-print{display:none}}' +
    '</style></head><body><h1>Thanks for your order.</h1>' +
    '<p>Enjoy your purchase. Know someone who would find DreamLedger useful?</p>' +
    '<a href="' + CANONICAL_QR_URL + '"><img src="' + CANONICAL_QR_ASSET + '" alt="Scan to explore DreamLedger"></a>' +
    '<p><strong>Scan to explore and share DreamLedger.</strong></p>' +
    '<p>' + CANONICAL_QR_URL + '</p>' +
    '<p class="small">Order reference: ' + qr.order_reference + ' · Product: ' + qr.product_id + '</p>' +
    '<button class="no-print" onclick="window.print()">Print insert</button></body></html>';
}

module.exports = { CANONICAL_QR_URL, CANONICAL_QR_ASSET, canonicalQrFulfillment, customerQrHtml, printableInsertHtml };
