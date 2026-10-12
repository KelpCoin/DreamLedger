import fs from 'node:fs/promises';

const offer = {
  id: 'DREAMLEDGER-BILLBOARD-FOUNDING-001',
  checkout_enabled: false,
  name: 'DreamLedger Founding Billboard',
  price_nzd: 50,
  currency: 'nzd',
  expected_payment_link_url: 'https://buy.stripe.com/00wcN5fe55lH0zRaIYdwc3i',
  retired_payment_link_url: 'https://buy.stripe.com/00w5kDc1Tg0l1DVcR6dwc3m',
  retired_product_id: 'agent-proof-audit-49',
  retired_price_id: 'price_1UOqk5EGgEAnUFF91kUGxhpx',
  product_page: 'https://dreamledger.org/billboard.html'
};

if (!process.env.STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY. Set it locally; never paste it into chat or logs.');
if (process.env.STRIPE_LIVE_ENABLED !== 'true') throw new Error('Fail-closed: set STRIPE_LIVE_ENABLED=true to permit read-only live reconciliation.');

const headers = { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY };
const api = 'https://api.stripe.com/v1';

async function stripe(path) {
  const response = await fetch(api + path, { headers });
  const body = await response.text();
  if (!response.ok) throw new Error('Stripe API ' + response.status + ': ' + body.slice(0, 600));
  return JSON.parse(body);
}

async function listAll(path, params = {}) {
  const rows = [];
  let cursor;
  for (;;) {
    const query = new URLSearchParams({ limit: '100', ...params });
    if (cursor) query.set('starting_after', cursor);
    const page = await stripe(path + '?' + query.toString());
    rows.push(...(page.data || []));
    if (!page.has_more || !page.data?.length) return rows;
    cursor = page.data[page.data.length - 1].id;
  }
}

const links = await listAll('/payment_links');
const link = links.find(x => x.url === offer.expected_payment_link_url);
const retiredLink = links.find(x => x.url === offer.retired_payment_link_url);
const [retiredProduct, retiredPrice] = await Promise.all([
  stripe('/products/' + encodeURIComponent(offer.retired_product_id)),
  stripe('/prices/' + encodeURIComponent(offer.retired_price_id))
]);
const [completeSessions, openSessions, expiredSessions] = await Promise.all([
  listAll('/checkout/sessions', { status: 'complete' }),
  listAll('/checkout/sessions', { status: 'open' }),
  listAll('/checkout/sessions', { status: 'expired' })
]);
const sessions = [...completeSessions, ...openSessions, ...expiredSessions];
const offerSessions = link ? sessions.filter(s => s.payment_link === link.id && s.livemode === true) : [];
const matches = offerSessions.filter(s =>
  s.livemode === true &&
  s.status === 'complete' &&
  s.payment_status === 'paid' &&
  s.currency === offer.currency &&
  s.amount_total === offer.price_nzd * 100
);
const wrongPriceOrCurrency = offerSessions.filter(s =>
  s.livemode === true &&
  s.status === 'complete' &&
  s.payment_status === 'paid' &&
  !(s.currency === offer.currency && s.amount_total === offer.price_nzd * 100)
);
const paidOfferSessions = offerSessions.filter(s => s.livemode === true && s.status === 'complete' && s.payment_status === 'paid');
const sessionStartCount = offerSessions.length;
const checkoutSessionPaidRate = sessionStartCount ? Number((paidOfferSessions.length / sessionStartCount).toFixed(4)) : null;

const proof = {
  schema: 'BECK-BILLBOARD-STRIPE-RECONCILIATION/v1',
  generated_at_utc: new Date().toISOString(),
  mode: 'READ_ONLY_LIVE_STRIPE',
  offer,
  retired_offer: {
    payment_link_found: Boolean(retiredLink),
    payment_link_active: retiredLink?.active ?? null,
    product_active: retiredProduct.active === true,
    price_active: retiredPrice.active === true,
    retirement_verified: Boolean(retiredLink && retiredLink.active === false && retiredProduct.active === false && retiredPrice.active === false),
    billboard_checkout_hold_verified: Boolean(link && link.active === false && offer.checkout_enabled === false),
    billboard_payment_link_active: link?.active ?? null
  },
  live_stripe: {
    exact_payment_link_found: Boolean(link),
    payment_link_id: link?.id || null,
    payment_link_active: link?.active ?? null,
    completed_checkout_sessions_scanned: completeSessions.length,
    open_checkout_sessions_scanned: openSessions.length,
    expired_checkout_sessions_scanned: expiredSessions.length,
    offer_checkout_funnel: {
      sessions_started_for_exact_payment_link: sessionStartCount,
      completed_paid_sessions_any_amount: paidOfferSessions.length,
      open_sessions: offerSessions.filter(s => s.status === 'open').length,
      expired_sessions: offerSessions.filter(s => s.status === 'expired').length,
      paid_rate_per_checkout_session_started: checkoutSessionPaidRate,
      interpretation: 'Checkout-session conversion only. It does not measure page visitors, link clicks without a session, unique buyers, or organic demand.'
    },
    exact_paid_live_sessions: matches.map(s => ({
      session_id: s.id,
      created_at_utc: new Date(s.created * 1000).toISOString(),
      amount_nzd: s.amount_total / 100,
      currency: s.currency,
      payment_status: s.payment_status,
      livemode: s.livemode,
      payment_link_id: s.payment_link,
      customer_email_recorded: Boolean(s.customer_details?.email),
      pii_stored: false
    })),
    paid_sessions_with_wrong_amount_or_currency: wrongPriceOrCurrency.map(s => ({
      session_id: s.id,
      amount_total_minor: s.amount_total,
      currency: s.currency,
      created_at_utc: new Date(s.created * 1000).toISOString()
    }))
  },
  economic_model: {
    price_nzd: offer.price_nzd,
    checkout_enabled_in_public_catalog: offer.checkout_enabled,
    gross_sales_for_1000_nzd: Math.ceil(1000 / offer.price_nzd),
    gross_sales_for_10000_nzd: Math.ceil(10000 / offer.price_nzd),
    gross_sales_for_1000000_nzd: Math.ceil(1000000 / offer.price_nzd),
    gross_revenue_nzd_from_matched_sessions: matches.length * offer.price_nzd,
    scenarios_are_arithmetic_not_forecasts: true,
    net_profit_or_bank_payout_established: false
  },
  decision: {
    payment_link_state: !link ? 'CONTRADICTED_LINK_NOT_FOUND' : link.active ? (offer.checkout_enabled ? 'ACTIVE_LINK_FOUND' : 'ACTIVE_LINK_HELD_NOT_PUBLIC') : 'INACTIVE_LINK_HELD_PENDING_FULFILLMENT',
    payment_evidence_state: matches.length ? 'SETTLED_PAYMENT_EVIDENCE_OBSERVED_PENDING_FULFILLMENT' : 'NO_MATCHED_PAID_SESSION_OBSERVED',
    verified_revenue_nzd: 0,
    reason: 'Founding Billboard public checkout remains held in the public catalog until signed-webhook inventory allocation and publication are independently verified. This read-only Stripe check cannot establish an independent buyer, fulfillment, delivery, refunds/disputes, net profit, or bank payout.',
    required_next_proof: [
      'Confirm payment remains settled and is not refunded or disputed.',
      'Correlate one independent buyer to the approved offer without retaining unnecessary personal data.',
      'Keep paid checkout held until the Billboard payment-to-publication and payment-to-allocation-to-publication path passes.',
      'Record report hash or stable artifact reference and delivery timestamp/evidence.',
      'Reconcile Stripe payout and bank receipt separately.',
      'Do not restore the retired standalone offer; its bounded review capability is part of Billboard.'
    ]
  }
};

await fs.mkdir('proof/commerce', { recursive: true });
await fs.writeFile('proof/commerce/latest-first-dollar-stripe-reconciliation.json', JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));
