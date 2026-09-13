#!/usr/bin/env node

const stripeKey = process.env.STRIPE_SECRET_KEY;
const paymentLinkId = process.env.MAXIMONA_PAYMENT_LINK_ID || 'plink_1UEsfSEGgEAnUFF9paXFhlAo';
const apiVersion = process.env.STRIPE_API_VERSION || '2026-08-26.dahlia';

if (!stripeKey) {
  console.error('STRIPE_SECRET_KEY is required');
  process.exit(2);
}

const base = 'https://api.stripe.com/v1';
const headers = {
  Authorization: `Bearer ${stripeKey}`,
  'Stripe-Version': apiVersion,
};

async function stripe(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(`Stripe ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

function encodeForm(data) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) params.set(key, value);
  return params;
}

const required = {
  product_sku: 'MAXIMONA-IPV-001',
  silo: 'maximona',
  offer_id: 'OFFER-MAXIMONA-IPV-001',
  environment: 'live',
};

async function main() {
  const before = await stripe(`/payment_links/${paymentLinkId}`);
  const existingPaymentIntentMetadata = before.payment_intent_data?.metadata || {};
  const mergedPaymentIntentMetadata = { ...existingPaymentIntentMetadata, ...required };
  const mergedTopLevelMetadata = { ...(before.metadata || {}), ...required };

  console.log(JSON.stringify({
    stage: 'READ_BEFORE',
    payment_link_id: paymentLinkId,
    top_level_metadata: before.metadata || {},
    payment_intent_metadata_before: existingPaymentIntentMetadata,
    payment_intent_metadata_after: mergedPaymentIntentMetadata,
  }, null, 2));

  const form = {};
  for (const [key, value] of Object.entries(mergedTopLevelMetadata)) form[`metadata[${key}]`] = value;
  for (const [key, value] of Object.entries(mergedPaymentIntentMetadata)) form[`payment_intent_data[metadata][${key}]`] = value;

  await stripe(`/payment_links/${paymentLinkId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodeForm(form),
  });

  const after = await stripe(`/payment_links/${paymentLinkId}`);
  const actual = after.payment_intent_data?.metadata || {};
  const pass = Object.entries(mergedPaymentIntentMetadata).every(([key, value]) => actual[key] === value);

  console.log(JSON.stringify({
    stage: 'READ_AFTER',
    payment_link_id: paymentLinkId,
    payment_intent_metadata: actual,
    required_keys: required,
    pass,
  }, null, 2));

  if (!pass) process.exit(1);
  console.log('MAXIMONA_PAYMENT_LINK_METADATA=PASS');
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
