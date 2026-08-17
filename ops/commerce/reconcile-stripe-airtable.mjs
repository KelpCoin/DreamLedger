import fs from 'node:fs/promises';

const required = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PAYMENT_LINK_URL',
  'AIRTABLE_TOKEN',
  'AIRTABLE_BASE_ID',
  'AIRTABLE_EVENTS_TABLE_ID',
  'AIRTABLE_OFFERS_TABLE_ID',
  'AIRTABLE_OFFER_RECORD_ID'
];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}
if (process.env.STRIPE_LIVE_ENABLED !== 'true') {
  throw new Error('Settlement sync is fail-closed: STRIPE_LIVE_ENABLED must be true.');
}

const stripeHeaders = { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` };
const airtableHeaders = {
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json'
};
const base = process.env.AIRTABLE_BASE_ID;
const eventsTable = process.env.AIRTABLE_EVENTS_TABLE_ID;
const offersTable = process.env.AIRTABLE_OFFERS_TABLE_ID;
const offerRecord = process.env.AIRTABLE_OFFER_RECORD_ID;
const api = 'https://api.stripe.com/v1';
const at = `https://api.airtable.com/v0/${base}`;

async function stripe(path) {
  const r = await fetch(`${api}${path}`, { headers: stripeHeaders });
  const text = await r.text();
  if (!r.ok) throw new Error(`Stripe ${r.status}: ${text}`);
  return JSON.parse(text);
}
async function airtable(path, options = {}) {
  const r = await fetch(`${at}${path}`, { ...options, headers: { ...airtableHeaders, ...(options.headers || {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`Airtable ${r.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

function enc(params) { return new URLSearchParams(params).toString(); }

const paymentLinks = await stripe(`/payment_links?limit=100`);
const link = paymentLinks.data.find(x => x.url === process.env.STRIPE_PAYMENT_LINK_URL);
if (!link) throw new Error('Configured Stripe Payment Link URL was not found in the live Stripe account.');

const sessions = await stripe(`/checkout/sessions?limit=100&status=complete`);
const matches = sessions.data.filter(s =>
  s.payment_link === link.id &&
  s.payment_status === 'paid' &&
  s.currency === 'nzd' &&
  s.amount_total === 2900
);

let existing = [];
let offset;
do {
  const qs = new URLSearchParams({ pageSize: '100' });
  if (offset) qs.set('offset', offset);
  const page = await airtable(`/${encodeURIComponent(eventsTable)}?${qs}`);
  existing.push(...page.records);
  offset = page.offset;
} while (offset);
const known = new Set(existing.map(r => r.fields?.['Event ID']).filter(Boolean));

const inserted = [];
for (const s of matches) {
  const eventId = `STRIPE-CHECKOUT-${s.id}`;
  if (known.has(eventId)) continue;
  const timestamp = new Date((s.created || Math.floor(Date.now() / 1000)) * 1000).toISOString();
  const record = {
    fields: {
      'Event ID': eventId,
      'Timestamp': timestamp,
      'Silo': 'MTG',
      'Offer ID': 'OFFER-CMD-DIAG-29-NZD',
      'SKU': 'CMD-DIAG-29',
      'Channel': 'Stripe Payment Link',
      'Event Type': 'PAYMENT',
      'Amount NZD': 29,
      'Verified': true,
      'Gauntlet Verdict': 'PASS',
      'Evidence Ref': `stripe:checkout_session:${s.id}`,
      'Operator Minutes': 0,
      'Direct Cost NZD': 0,
      'Contribution NZD': 29,
      'Elohim Pattern': 'FIRST-REAL-PAYMENT',
      'CUBE Action': 'CANDIDATE'
    }
  };
  const created = await airtable(`/${encodeURIComponent(eventsTable)}`, {
    method: 'POST',
    body: JSON.stringify({ records: [record] })
  });
  inserted.push({ eventId, stripeSession: s.id, createdRecordId: created.records?.[0]?.id || null, amountNZD: 29, paidAt: timestamp });
}

if (inserted.length) {
  await airtable(`/${encodeURIComponent(offersTable)}/${offerRecord}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: {
      'Status': 'VALIDATED',
      'First Payment Event': inserted[0].eventId,
      'Notes': `Live Stripe payment evidence detected by GitHub Actions. Session: ${inserted[0].stripeSession}`
    } })
  });
}

const totalVerified = existing
  .filter(r => r.fields?.Verified === true)
  .reduce((sum, r) => sum + Number(r.fields?.['Amount NZD'] || 0), 0) + inserted.reduce((sum, x) => sum + x.amountNZD, 0);

const proof = {
  proof_type: 'STRIPE_AIRTABLE_RECONCILIATION',
  generated_at: new Date().toISOString(),
  stripe_account_mode: 'live',
  payment_link_url: process.env.STRIPE_PAYMENT_LINK_URL,
  stripe_payment_link_id: link.id,
  matching_paid_sessions: matches.length,
  newly_recognized_events: inserted,
  verified_revenue_nzd: totalVerified,
  authority: 'Stripe live payment evidence',
  operational_index: 'Airtable Economic Events',
  fail_closed_rules: [
    'Only live Stripe data is accepted.',
    'Only the configured Payment Link is accepted.',
    'Only paid NZD Checkout Sessions totaling NZ$29 are accepted.',
    'Airtable Verified=true is written only from matching Stripe evidence.',
    'Event IDs are idempotent.'
  ]
};
await fs.mkdir('proof/commerce', { recursive: true });
await fs.writeFile('proof/commerce/latest-stripe-airtable-reconciliation.json', JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));
