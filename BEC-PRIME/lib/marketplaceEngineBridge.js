'use strict';

const ENGINE = String(process.env.MARKETPLACE_ENGINE || '').trim().toLowerCase();
const BASE_URL = String(process.env.MARKETPLACE_ENGINE_URL || '').replace(/\/$/, '');
const PUBLISHABLE_KEY = String(process.env.MARKETPLACE_ENGINE_PUBLISHABLE_KEY || '').trim();

function configured() {
  return ENGINE === 'mercur' && Boolean(BASE_URL);
}

function headers() {
  const h = { Accept: 'application/json' };
  if (PUBLISHABLE_KEY) h['x-publishable-api-key'] = PUBLISHABLE_KEY;
  return h;
}

async function request(pathname) {
  if (!configured()) return null;
  const response = await fetch(BASE_URL + pathname, { headers: headers() });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!response.ok) {
    const error = new Error('Marketplace engine request failed: ' + response.status);
    error.status = response.status;
    throw error;
  }
  return data;
}

function rows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.offers)) return data.offers;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function normalizeOffer(raw) {
  const product = raw?.product || {};
  const calculated = raw?.calculated_price || raw?.calculatedPrice || {};
  const price = Number(
    raw?.price ??
    calculated?.calculated_amount ??
    calculated?.calculatedAmount ??
    raw?.amount ??
    product?.price ??
    0
  );
  const currency = String(
    raw?.currency_code ??
    raw?.currency ??
    calculated?.currency_code ??
    calculated?.currencyCode ??
    product?.currency_code ??
    'nzd'
  ).toUpperCase();

  return {
    external_engine: 'mercur',
    external_offer_id: raw?.id || raw?.offer_id || null,
    external_product_id: raw?.product_id || product?.id || null,
    external_seller_id: raw?.seller_id || raw?.store_id || null,
    sku: raw?.sku || product?.handle || product?.id || null,
    title: raw?.title || raw?.name || product?.title || product?.name || 'Untitled offer',
    description: raw?.description || product?.description || '',
    category: raw?.category || null,
    price_nzd: currency === 'NZD' ? price / 100 : null,
    currency,
    inventory: Number(raw?.inventory_quantity ?? raw?.inventory ?? product?.inventory_quantity ?? 0),
    fulfillment_type: raw?.fulfillment_type || 'external_marketplace',
    status: raw?.status || 'available',
    source: 'mercur'
  };
}

async function snapshot() {
  if (!configured()) return { configured: false, engine: null, offers: [] };
  const data = await request('/store/offers?limit=100');
  return {
    configured: true,
    engine: 'mercur',
    offers: rows(data).map(normalizeOffer),
    fetched_at: new Date().toISOString()
  };
}

async function health() {
  if (!configured()) return { configured: false, engine: null, healthy: false };
  try {
    await request('/store/offers?limit=1');
    return { configured: true, engine: 'mercur', healthy: true };
  } catch (error) {
    return { configured: true, engine: 'mercur', healthy: false, error: error.message };
  }
}

module.exports = { configured, snapshot, health, normalizeOffer };
