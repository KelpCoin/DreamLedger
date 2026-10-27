import fs from 'node:fs/promises';
import { classifyEconomicEvidence } from './revenue-evidence-gate.mjs';

const required = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PAYMENT_LINK_URL'
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

if (process.env.STRIPE_LIVE_ENABLED !== 'true') {
  throw new Error('Settlement sync is fail-closed: STRIPE_LIVE_ENABLED must be true.');
}

const stripeHeaders = {
  Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`
};

const airtableEnabled = Boolean(
  process.env.AIRTABLE_TOKEN &&
  process.env.AIRTABLE_BASE_ID &&
  process.env.AIRTABLE_EVENTS_TABLE_ID &&
  process.env.AIRTABLE_OFFERS_TABLE_ID &&
  process.env.AIRTABLE_OFFER_RECORD_ID
);

const airtableHeaders = airtableEnabled
  ? {
      Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    }
  : null;

const base = process.env.AIRTABLE_BASE_ID;
const eventsTable = process.env.AIRTABLE_EVENTS_TABLE_ID;
const offersTable = process.env.AIRTABLE_OFFERS_TABLE_ID;
const offerRecord = process.env.AIRTABLE_OFFER_RECORD_ID;

const api = 'https://api.stripe.com/v1';
const at = airtableEnabled ? `https://api.airtable.com/v0/${base}` : null;
const APPROVED_OFFERS_PATH = 'BEC-PRIME/catalog/offers/approved.json';

async function stripe(path) {
  const r = await fetch(`${api}${path}`, { headers: stripeHeaders });
  const text = await r.text();
  if (!r.ok) throw new Error(`Stripe ${r.status}: ${text}`);
  return JSON.parse(text);
}

async function stripeList(path, params = {}) {
  const rows = [];
  let startingAfter = null;
  for (;;) {
    const query = new URLSearchParams({ limit: '100', ...params });
    if (startingAfter) query.set('starting_after', startingAfter);
    const page = await stripe(`${path}?${query.toString()}`);
    rows.push(...(page.data || []));
    if (!page.has_more || !page.data?.length) return rows;
    startingAfter = page.data[page.data.length - 1].id;
  }
}

async function airtable(path, options = {}) {
  if (!airtableEnabled) throw new Error('Airtable is not enabled for this run.');
  const r = await fetch(`${at}${path}`, {
    ...options,
    headers: { ...airtableHeaders, ...(options.headers || {}) }
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Airtable ${r.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

const approvedDoc = JSON.parse(
  await fs.readFile(APPROVED_OFFERS_PATH, 'utf8')
);

const configuredUrl = process.env.STRIPE_PAYMENT_LINK_URL;
const approvedOffers = Array.isArray(approvedDoc.approved)
  ? approvedDoc.approved
  : [];

const configuredOffer = approvedOffers.find(
  offer => offer.payment_link_url === configuredUrl
);

if (!configuredOffer) {
  throw new Error(
    'Configured Stripe Payment Link URL does not match an approved offer.'
  );
}

const expectedAmountNzd = Number(configuredOffer.price);
const expectedAmountCents = Math.round(expectedAmountNzd * 100);
const expectedOfferId = configuredOffer.offer_id;
const expectedProductId = configuredOffer.product_id;
const expectedSku = configuredOffer.product_sku;

if (!Number.isInteger(expectedAmountCents) || expectedAmountCents <= 0) {
  throw new Error(`Approved offer has invalid price: ${configuredOffer.price}`);
}

const paymentLinks = await stripeList('/payment_links', { active: 'true' });
const link = paymentLinks.find(x => x.url === configuredUrl);

if (!link) {
  throw new Error(
    'Configured Stripe Payment Link URL was not found in the live Stripe account.'
  );
}

if (link.livemode !== true) {
  throw new Error('Configured Stripe Payment Link is not live.');
}

if (configuredOffer.payment_link_id && link.id !== configuredOffer.payment_link_id) {
  throw new Error(
    `Stripe Payment Link ID mismatch. Approved=${configuredOffer.payment_link_id}, Live=${link.id}`
  );
}

const sessions = await stripeList('/checkout/sessions', { status: 'complete' });

// Reconcile processor evidence. Matching amounts and checkout status alone
// cannot be recorded as delivery, independent-buyer revenue or net margin.
const linkedItems = await stripe('/payment_links/' + encodeURIComponent(link.id) + '/line_items?limit=100');
const approvedPriceIds = new Set((linkedItems.data || []).map(item => item.price?.id).filter(Boolean));
if (linkedItems.has_more === true || approvedPriceIds.size === 0) {
  throw new Error('Payment Link price inventory unavailable or incomplete');
}
const candidates = sessions.filter(s =>
  s.payment_link === link.id &&
  s.payment_status === 'paid' &&
  s.currency === String(configuredOffer.currency || 'NZD').toLowerCase() &&
  s.amount_total === expectedAmountCents &&
  s.livemode === true
);
const matches = [];
const excluded = [];
for (const s of candidates) {
  if (typeof s.payment_intent !== 'string') {
    excluded.push({ session_id: s.id, reason: 'missing_payment_intent' });
    continue;
  }
  const sessionItems = await stripe('/checkout/sessions/' + encodeURIComponent(s.id) + '/line_items?limit=100');
  if (sessionItems.has_more === true || !(sessionItems.data || []).some(item => approvedPriceIds.has(item.price?.id))) {
    excluded.push({ session_id: s.id, reason: 'line_item_price_mismatch' });
    continue;
  }
  const intent = await stripe('/payment_intents/' + encodeURIComponent(s.payment_intent));
  const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id;
  const charge = chargeId ? await stripe('/charges/' + encodeURIComponent(chargeId)) : null;
  const evidence = classifyEconomicEvidence({
    checkoutLivemode: s.livemode === true,
    checkoutPaid: s.payment_status === 'paid',
    paymentIntentSucceeded: intent.livemode === true &&
      intent.status === 'succeeded' &&
      intent.currency === s.currency &&
      Number(intent.amount_received) === expectedAmountCents,
    chargeUnrefunded: charge?.livemode === true &&
      charge?.paid === true &&
      charge?.status === 'succeeded' &&
      charge?.refunded === false &&
      Number(charge?.amount_refunded || 0) === 0 &&
      charge?.currency === s.currency,
    exactOfferMatched: true
  });
  if (!evidence.processor_payment_observed) {
    excluded.push({ session_id: s.id, reason: 'processor_payment_not_confirmed' });
    continue;
  }
  matches.push({ session: s, payment_intent_id: intent.id, charge_id: charge.id, evidence });
}
changes.push('processor and price verification');
let existing = [];

if (airtableEnabled) {
  let offset;
  do {
    const qs = new URLSearchParams({ pageSize: '100' });
    if (offset) qs.set('offset', offset);
    const page = await airtable(`/${encodeURIComponent(eventsTable)}?${qs}`);
    existing.push(...(page.records || []));
    offset = page.offset;
  } while (offset);
}

const known = new Set(
  existing.map(r => r.fields?.['Event ID']).filter(Boolean)
);

const inserted = [];

for (const { session: s } of matches) {
  const eventId = `STRIPE-CHECKOUT-${s.id}`;
  if (known.has(eventId)) continue;

  const timestamp = new Date(
    (s.created || Math.floor(Date.now() / 1000)) * 1000
  ).toISOString();

  const record = {
    fields: {
      'Event ID': eventId,
      'Timestamp': timestamp,
      'Silo': configuredOffer.silo || 'unknown',
      'Offer ID': expectedOfferId,
      'SKU': expectedSku,
      'Product ID': expectedProductId,
      'Channel': 'Stripe Payment Link',
      'Event Type': 'PAYMENT',
      'Amount NZD': expectedAmountNzd,
      'Verified': false,
      'Evidence Ref': `stripe:checkout_session:${s.id}`,
      'Elohim Pattern': 'PAID_AWAITING_BUYER_AND_DELIVERY_PROOF',
      'CUBE Action': 'CANDIDATE'
    }
  };

  if (airtableEnabled) {
    const created = await airtable(
      `/${encodeURIComponent(eventsTable)}`,
      {
        method: 'POST',
        body: JSON.stringify({ records: [record] })
      }
    );

    inserted.push({
      eventId,
      stripeSession: s.id,
      createdRecordId: created.records?.[0]?.id || null,
      amountNZD: expectedAmountNzd,
      paidAt: timestamp,
      offerId: expectedOfferId,
      productId: expectedProductId,
      sku: expectedSku
    });
  } else {
    inserted.push({
      eventId,
      stripeSession: s.id,
      createdRecordId: null,
      amountNZD: expectedAmountNzd,
      paidAt: timestamp,
      offerId: expectedOfferId,
      productId: expectedProductId,
      sku: expectedSku
    });
  }
}

// Offers remain in their existing commercial state.
// This observer does not mark an offer VALIDATED or infer contribution margin.
const observedGrossNzd = matches.length * expectedAmountNzd;
const proof = {
  proof_type: airtableEnabled
    ? 'STRIPE_AIRTABLE_RECONCILIATION'
    : 'STRIPE_LIVE_RECONCILIATION',
  generated_at: new Date().toISOString(),
  stripe_account_mode: 'live',
  payment_link_url: configuredUrl,
  stripe_payment_link_id: link.id,
  offer_id: expectedOfferId,
  product_id: expectedProductId,
  sku: expectedSku,
  expected_amount_nzd: expectedAmountNzd,
  scanned_live_payment_links: paymentLinks.length,
  scanned_completed_checkout_sessions: sessions.length,
  matching_paid_sessions: matches.length,
  excluded_payment_candidates: excluded,
  validated_processor_payment_intents: matches.map(x => x.payment_intent_id),
  validated_non_refunded_charges: matches.map(x => x.charge_id),
  paid_observed_gross_nzd: observedGrossNzd,
  buyer_independence: 'NOT_ASSESSED',
  fulfillment_evidence: 'NOT_ASSESSED',
  settlement_evidence: 'NOT_ASSESSED',
  actual_cost_evidence: 'NOT_ASSESSED',
  newly_recognized_events: inserted,
  verified_revenue_nzd: 0,
  verified_revenue_scope: 'NOT_ESTABLISHED_BY_PAYMENT_OBSERVER',
  economic_status: 'PAYMENT_OBSERVATION_ONLY',
  authority: 'Processor evidence only; neither independent buyer nor delivery nor actual contribution verified',
  commercial_definition: APPROVED_OFFERS_PATH,
  operational_index: airtableEnabled
    ? 'Airtable Economic Events'
    : 'Stripe live evidence (Airtable unavailable)',
  airtable_sync: airtableEnabled ? 'ENABLED' : 'NOT_AVAILABLE',
  fail_closed_rules: [
    'Only live Stripe data is accepted.',
    'Only the configured Payment Link is accepted.',
    'The configured Payment Link must match an approved offer.',
    'The live Stripe Payment Link ID must match the approved offer when specified.',
    'Only paid live Checkout Sessions matching the approved offer currency and price are accepted.',
    'Every observed payment requires an exactly matching payment-link line-item Price.',
    'Successful PaymentIntent and successful non-refunded Charge must both be independently retrieved.',
    'A payment observation never sets Airtable Verified=true or marks its offer VALIDATED.',
    'Contribution remains unknown without measured costs and independently proven delivery.',
    'Event IDs are idempotent.',
    'Stripe list endpoints are fully paginated.',
    'Airtable is an indexing sink, not the authority for whether payment occurred.'
  ]
};

await fs.mkdir('proof/commerce', { recursive: true });
await fs.writeFile(
  'proof/commerce/latest-stripe-airtable-reconciliation.json',
  JSON.stringify(proof, null, 2) + '\n',
  'utf8'
);

console.log(JSON.stringify(proof, null, 2));
