import fs from 'node:fs/promises';

const required = ['STRIPE_SECRET_KEY'];
for (const key of required) {
  if (!process.env[key]) throw new Error('Missing required environment variable: ' + key);
}
if (process.env.STRIPE_LIVE_ENABLED !== 'true') {
  throw new Error('Settlement reconciliation is fail-closed: STRIPE_LIVE_ENABLED must be true.');
}

const api = 'https://api.stripe.com/v1';
const headers = { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY };
const approvedPath = 'BEC-PRIME/catalog/offers/approved.json';

async function stripe(path) {
  const r = await fetch(api + path, { headers });
  const text = await r.text();
  if (!r.ok) throw new Error('Stripe ' + r.status + ': ' + text.slice(0, 1000));
  return JSON.parse(text);
}

async function stripeList(path, params = {}) {
  const rows = [];
  let startingAfter = null;
  for (;;) {
    const query = new URLSearchParams({ limit: '100', ...params });
    if (startingAfter) query.set('starting_after', startingAfter);
    const page = await stripe(path + '?' + query.toString());
    rows.push(...(page.data || []));
    if (!page.has_more || !page.data?.length) return rows;
    startingAfter = page.data[page.data.length - 1].id;
  }
}

const approvedDoc = JSON.parse(await fs.readFile(approvedPath, 'utf8'));
const approved = (approvedDoc.approved || []).filter(
  x => x.payment_link_url && x.payment_link_status === 'ACTIVE_LIVEMODE'
);

if (!approved.length) throw new Error('No active live approved offers are configured.');

const links = await stripeList('/payment_links', { active: 'true' });
const sessions = await stripeList('/checkout/sessions', { status: 'complete' });

const liveApproved = [];
for (const offer of approved) {
  const link = links.find(x => x.url === offer.payment_link_url);
  if (!link) {
    liveApproved.push({
      offer_id: offer.offer_id,
      sku: offer.product_sku,
      state: 'CONTRADICTED',
      reason: 'Approved offer payment link was not found in the live Stripe account.'
    });
    continue;
  }

  const expectedCents = Math.round(Number(offer.price) * 100);
  const matches = sessions.filter(s =>
    s.payment_link === link.id &&
    s.payment_status === 'paid' &&
    s.currency === String(offer.currency || 'NZD').toLowerCase() &&
    s.amount_total === expectedCents &&
    s.livemode === true
  );

  liveApproved.push({
    offer_id: offer.offer_id,
    sku: offer.product_sku,
    name: offer.name,
    payment_link_id: link.id,
    payment_link_url: link.url,
    price_nzd: Number(offer.price),
    state: matches.length ? 'SETTLED_PENDING_FULFILLMENT' : 'PAYMENT_PENDING',
    matched_paid_sessions: matches.map(s => ({
      session_id: s.id,
      created_at: new Date(s.created * 1000).toISOString(),
      amount_nzd: s.amount_total / 100,
      payment_status: s.payment_status,
      attribution: 'payment_link -> approved_offer'
    }))
  });
}

const proof = {
  proof_type: 'STRIPE_APPROVED_OFFER_RECONCILIATION',
  generated_at: new Date().toISOString(),
  authority: 'Stripe live payment evidence',
  commercial_definition: approvedPath,
  scanned_live_payment_links: links.length,
  scanned_completed_checkout_sessions: sessions.length,
  approved_offer_count: approved.length,
  offers: liveApproved,
  truth_boundary: {
    settled_payment: liveApproved.some(x => x.state === 'SETTLED_PENDING_FULFILLMENT'),
    correct_attribution: 'payment_link -> approved offer when matched',
    fulfillment: 'NOT_ESTABLISHED_BY_THIS_RECONCILER',
    independent_proof: 'NOT_ESTABLISHED_BY_THIS_RECONCILER',
    business_truth: 'NOT_CLAIMED'
  },
  rules: [
    'Only live Stripe data is accepted.',
    'Only payment links declared by approved.json are commercial offers.',
    'Only paid live Checkout Sessions matching the approved offer currency and price count as settled payment evidence.',
    'A settled payment is not BusinessTruth until fulfillment and independent verification are established.',
    'Unmatched Stripe payments remain UNMATCHED and do not enter verified revenue.'
  ]
};

await fs.mkdir('proof/commerce', { recursive: true });
await fs.writeFile(
  'proof/commerce/latest-approved-offer-reconciliation.json',
  JSON.stringify(proof, null, 2) + '\n',
  'utf8'
);
console.log(JSON.stringify(proof, null, 2));
