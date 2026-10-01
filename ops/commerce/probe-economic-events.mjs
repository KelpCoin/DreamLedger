import fs from 'node:fs/promises';

const required = ['STRIPE_SECRET_KEY'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const headers = { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` };
const api = 'https://api.stripe.com/v1';

async function stripe(path) {
  const r = await fetch(`${api}${path}`, { headers });
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

const paymentLinks = await stripeList('/payment_links', { active: 'true' });
const saleReadyLinks = paymentLinks.filter(link => {
  const status = String(link.metadata?.status || '').toLowerCase();
  return link.livemode === true && status.includes('sale_ready');
});

const sessions = await stripeList('/checkout/sessions', { status: 'complete' });
const paidSessions = sessions.filter(session =>
  session.livemode === true &&
  session.status === 'complete' &&
  session.payment_status === 'paid'
);

const linkById = new Map(paymentLinks.map(link => [link.id, link]));
const matches = paidSessions
  .filter(session => linkById.has(session.payment_link))
  .map(session => {
    const link = linkById.get(session.payment_link);
    const metadata = link.metadata || {};
    return {
      event_id: `STRIPE-CHECKOUT-${session.id}`,
      checkout_session: session.id,
      payment_link: link.id,
      payment_link_url: link.url,
      offer_id: metadata.offer_id || null,
      sku: metadata.dreamledger_sku || null,
      silo: metadata.silo || null,
      status: metadata.status || null,
      currency: session.currency,
      amount_nzd: session.currency === 'nzd' ? Number(session.amount_total || 0) / 100 : null,
      payment_status: session.payment_status,
      created_at: new Date((session.created || 0) * 1000).toISOString()
    };
  });

const registered = new Set([
  'COMMANDER-DECK-DIAGNOSTIC-001',
  'PERSONAL-COMMERCE-CONSTITUTION',
  'DREAMLEDGER-OBSERVER',
  'DREAMLEDGER-ANALYST',
  'DREAMLEDGER-OPERATOR',
  'DREAMLEDGER-WHITE-LABEL',
  'AGENTIC-COMMERCE-READINESS-049',
  'OFFER-BEC-PRIME-ARCHITECTURE-AUDIT',
  'AGENTIC-SOVEREIGNTY-DIAGNOSTIC'
]);

const registeredMatches = matches.filter(match =>
  registered.has(match.offer_id) ||
  registered.has(match.sku) ||
  (match.offer_id === null && match.sku === null)
);

const verifiedRevenueNZD = registeredMatches
  .filter(match => match.currency === 'nzd')
  .reduce((sum, match) => sum + Number(match.amount_nzd || 0), 0);

const proof = {
  proof_type: 'PASSIVE_ECONOMIC_EVENT_PROBE',
  generated_at: new Date().toISOString(),
  stripe_account_mode: 'live',
  authority: 'Stripe live settlement evidence',
  scanned_live_payment_links: paymentLinks.length,
  sale_ready_live_payment_links: saleReadyLinks.length,
  scanned_completed_checkout_sessions: sessions.length,
  paid_live_checkout_sessions: paidSessions.length,
  registered_offer_matches: registeredMatches.length,
  verified_revenue_nzd: verifiedRevenueNZD,
  events: registeredMatches,
  rules: [
    'Read-only probe: no Stripe mutation.',
    'Read-only probe: no Airtable mutation.',
    'Only live Stripe data is accepted.',
    'Only complete paid Checkout Sessions are economic events.',
    'Test payments are excluded.',
    'Every event receives a deterministic STRIPE-CHECKOUT session identifier.',
    'The probe does not publish, activate, refund, or fulfil anything.',
    'The probe is advisory evidence; settlement reconciliation remains authoritative for accounting writes.'
  ]
};

await fs.mkdir('proof/commerce', { recursive: true });
await fs.writeFile(
  'proof/commerce/latest-economic-event-probe.json',
  JSON.stringify(proof, null, 2) + '\n',
  'utf8'
);
console.log(JSON.stringify(proof, null, 2));
