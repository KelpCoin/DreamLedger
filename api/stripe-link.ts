import { COMMERCE_SKU_CONTRACT, normalizeCanonicalSku } from '../supabase/functions/_shared/commerce-sku-contract.ts';

const STRIPE_API = 'https://api.stripe.com/v1/checkout/sessions';

const OFFERS = {
  'OFFER-BEC-PRIME-ARCHITECTURE-AUDIT': {
    sku: 'BEC-PRIME-ARCHITECTURE-AUDIT-001',
    product_id: 'BEC-PRIME-ARCHITECTURE-AUDIT-001',
    name: 'Agentic Commerce Readiness Audit',
    amount_nzd_cents: 4900,
    silo: 'commerce',
  },
  EDH_0001: {
    sku: 'EDH_0001',
    product_id: 'EDH_0001',
    name: 'EDH_0001',
    amount_nzd_cents: 40000,
    silo: 'mtg',
  },
  'OFFER-CMD-DIAG-29-NZD': {
    canonical_offer_id: 'OFFER-CMD-DIAG-29-NZD',
    sku: 'COMMANDER-DECK-DIAGNOSTIC-001',
    product_id: 'COMMANDER-DECK-DIAGNOSTIC-001',
    name: 'Commander Deck Diagnostic',
    amount_nzd_cents: 2900,
    silo: 'mtg',
  },
  'CMD-DIAG-29': {
    canonical_offer_id: 'OFFER-CMD-DIAG-29-NZD',
    sku: 'COMMANDER-DECK-DIAGNOSTIC-001',
    product_id: 'COMMANDER-DECK-DIAGNOSTIC-001',
    name: 'Commander Deck Diagnostic',
    amount_nzd_cents: 2900,
    silo: 'mtg',
  },
  'OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001': {
    sku: 'DL-BILLBOARD-100X100-3000-001',
    product_id: 'DREAMLEDGER-BILLBOARD-FOUNDING-001',
    name: 'DreamLedger Founding Tile',
    amount_nzd_cents: 5000,
    silo: 'dreamledger',
    custom_fields: [
      { key: 'tile_alt_text', type: 'text', label: 'Billboard title', required: true },
      { key: 'destination_url', type: 'text', label: 'Destination URL', required: true },
      { key: 'tile_image_url', type: 'text', label: 'Public image URL', required: true },
    ],
  },
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return json({ error: 'STRIPE_SECRET_KEY is not configured' }, 503);

  let body: { offer_id?: string; product_id?: string; sku?: string; silo?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const requested = body.offer_id || body.product_id || body.sku;
  const offer = requested ? OFFERS[requested as keyof typeof OFFERS] : undefined;
  if (!offer) return json({ error: 'Unknown or missing approved offer', requested }, 400);
  const skuMappings = COMMERCE_SKU_CONTRACT.offer_mappings as Record<string, string>;
  const canonicalSku = normalizeCanonicalSku(skuMappings[offer.sku] || offer.sku);
  const canonicalOfferIds = COMMERCE_SKU_CONTRACT.canonical_offer_ids as Record<string, string>;
  const canonicalOfferId = canonicalOfferIds[requested] || ('canonical_offer_id' in offer ? offer.canonical_offer_id : (requested || offer.sku));
  if (!canonicalSku || !canonicalOfferId) return json({ error: 'Canonical SKU and offer ID are required', requested }, 400);
  if (body.silo && body.silo !== offer.silo) return json({ error: 'Silo mismatch', expected_silo: offer.silo }, 409);

  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('line_items[0][price_data][currency]', 'nzd');
  form.set('line_items[0][price_data][product_data][name]', offer.name);
  form.set('line_items[0][price_data][product_data][metadata][sku_id]', canonicalSku);
  form.set('line_items[0][price_data][product_data][metadata][sku]', canonicalSku);
  form.set('line_items[0][price_data][product_data][metadata][product_id]', offer.product_id);
  form.set('line_items[0][price_data][unit_amount]', String(offer.amount_nzd_cents));
  form.set('line_items[0][quantity]', '1');
  form.set('success_url', 'https://dreamledger.org/success?session_id={CHECKOUT_SESSION_ID}');
  form.set('cancel_url', 'https://dreamledger.org/cancel');
  form.set('metadata[offer_id]', canonicalOfferId);
  form.set('metadata[product_id]', offer.product_id);
  form.set('metadata[silo]', offer.silo);
  form.set('metadata[sku_id]', canonicalSku);
  form.set('metadata[sku]', canonicalSku);
  form.set('metadata[product_sku]', canonicalSku);
  form.set('metadata[source]', 'stripe_link');
  form.set('payment_intent_data[metadata][product_id]', offer.product_id);
  form.set('payment_intent_data[metadata][sku_id]', canonicalSku);
  form.set('payment_intent_data[metadata][sku]', canonicalSku);
  form.set('payment_intent_data[metadata][product_sku]', canonicalSku);
  form.set('payment_intent_data[metadata][offer_id]', canonicalOfferId);
  form.set('payment_intent_data[metadata][silo]', offer.silo);
  form.set('payment_intent_data[metadata][source]', 'stripe_link');

  if ('custom_fields' in offer && Array.isArray(offer.custom_fields)) {
    offer.custom_fields.forEach((field, index) => {
      form.set(`custom_fields[${index}][key]`, field.key);
      form.set(`custom_fields[${index}][type]`, field.type);
      form.set(`custom_fields[${index}][label][type]`, 'custom');
      form.set(`custom_fields[${index}][label][custom]`, field.label);
      form.set(`custom_fields[${index}][optional]`, field.required ? 'false' : 'true');
    });
  }

  const response = await fetch(STRIPE_API, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });

  const result = await response.json();
  if (!response.ok) {
    console.error('STRIPE_CHECKOUT_CREATE_FAILED', result);
    return json({ error: 'Stripe checkout creation failed' }, 502);
  }

  return json({
    offer_id: canonicalOfferId,
    product_id: offer.product_id,
    sku_id: canonicalSku,
    silo: offer.silo,
    amount_nzd: offer.amount_nzd_cents / 100,
    session_id: result.id,
    url: result.url,
  });
}
