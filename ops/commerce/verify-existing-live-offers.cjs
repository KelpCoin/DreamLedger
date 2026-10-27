#!/usr/bin/env node
'use strict';
// Read-only provider contract check. No customer data is fetched or printed.
// Never treats an active link, a checkout session or a payout as earned revenue.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const config = require(path.join(root, 'BEC-PRIME/catalog/offers/approved.json'));
const key = process.env.STRIPE_SECRET_KEY || '';
const EXPECTED_ACCOUNT = 'acct_1SNVPvEGgEAnUFF9';
const BILLBOARD = 'OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001';
const WEBHOOK = 'we_1U8xG2EGgEAnUFF9Rpzu7WTF';
const DESTINATION = 'https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/dreamledger-billboard-webhook';
const outputDir = process.env.BECK_PROOF_DIR || path.join(root, 'data', 'proofs');
async function getStripe(relative) {
  const response = await fetch('https://api.stripe.com/v1/' + relative, {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + key },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('STRIPE_GET_FAILED_' + response.status);
  return response.json();
}
function assert(condition, message, errors) { if (!condition) errors.push(message); }
async function run() {
  const entries = Array.isArray(config.approved) ? config.approved : [];
  const results = [];
  for (const offer of entries.filter(x => x.approved_by === 'operator' && x.payment_link_status === 'ACTIVE_LIVEMODE')) {
    const errors = [];
    const id = String(offer.payment_link_id || '');
    const row = { offer_id: offer.offer_id, silo: offer.silo, payment_link_id: id,
      status: 'UNVERIFIED', errors, notes: [] };
    assert(/^plink_[A-Za-z0-9]+$/.test(id), 'CANONICAL_LINK_ID_MISSING', errors);
    assert(/^https:\/\/buy\.stripe\.com\//.test(offer.payment_link_url || ''), 'CHECKOUT_URL_INVALID', errors);
    if (id && /^plink_/.test(id) && key) {
      try {
        const link = await getStripe('payment_links/' + encodeURIComponent(id));
        const items = await getStripe('payment_links/' + encodeURIComponent(id) + '/line_items?limit=100');
        assert(link.livemode === true, 'NOT_LIVE', errors);
        assert(link.active === true, 'LINK_INACTIVE', errors);
        assert(link.url === offer.payment_link_url, 'LINK_URL_MISMATCH', errors);
        assert(link.currency === String(offer.currency).toLowerCase(), 'CURRENCY_MISMATCH', errors);
        assert(Array.isArray(items.data) && items.data.length === 1 &&
          Number(items.data[0].amount_total) === Math.round(Number(offer.price) * 100) &&
          Number(items.data[0].quantity) === 1, 'ONE_TIME_PRICE_MISMATCH', errors);
        if (link.metadata?.offer_id) assert(link.metadata.offer_id === offer.offer_id, 'OFFER_METADATA_MISMATCH', errors);
        if (link.metadata?.product_id) assert(link.metadata.product_id === offer.product_id, 'PRODUCT_METADATA_MISMATCH', errors);
        if (offer.offer_id === BILLBOARD) {
          assert(items.data?.[0]?.price?.id === 'price_1U8xD6EGgEAnUFF9KGrq2t7X', 'BILLBOARD_PRICE_ID_MISMATCH', errors);
          assert(link.metadata?.sku === 'DL-BILLBOARD-100X100-3000-001', 'BILLBOARD_SKU_MISMATCH', errors);
          assert(link.custom_fields?.some(f => f.key === 'billboard_label' && f.optional === false), 'BILLBOARD_LABEL_NOT_REQUIRED', errors);
          assert(link.custom_fields?.some(f => f.key === 'destination_url'), 'DESTINATION_FIELD_MISSING', errors);
          row.notes.push('Human review, buyer independence, settlement and delivered placement remain separately unverified.');
        }
        row.status = errors.length ? 'FAIL' : 'PROVIDER_LINK_MATCH';
      } catch (error) {
        errors.push(String(error.message || 'STRIPE_LOOKUP_FAILED'));
        row.status = 'PROVIDER_UNREACHABLE';
      }
    } else if (!key) {
      errors.push('STRIPE_SECRET_KEY_NOT_PRESENT_READ_ONLY_LIVE_CHECK_SKIPPED');
    }
    results.push(row);
  }
  const webhook = { id: WEBHOOK, status: 'UNVERIFIED', errors: [] };
  if (key) {
    try {
      const dest = await getStripe('webhook_endpoints/' + encodeURIComponent(WEBHOOK));
      assert(dest.livemode === true && dest.status === 'enabled', 'WEBHOOK_NOT_ENABLED_IN_LIVE_MODE', webhook.errors);
      assert(dest.url === DESTINATION, 'WEBHOOK_DESTINATION_MISMATCH', webhook.errors);
      assert((dest.enabled_events || []).includes('checkout.session.completed'), 'CHECKOUT_COMPLETED_NOT_SUBSCRIBED', webhook.errors);
      webhook.status = webhook.errors.length ? 'FAIL' : 'PROVIDER_WEBHOOK_MATCH';
    } catch (error) {
      webhook.status = 'PROVIDER_UNREACHABLE';
      webhook.errors.push(String(error.message || 'WEBHOOK_LOOKUP_FAILED'));
    }
  }
  const proof = { schema: 'dreamledger/existing-offer-provider-parity/v1',
    observed_at: new Date().toISOString(), account_expected: EXPECTED_ACCOUNT,
    account_verified: false, // API-key account identity is not independently checked here.
    mode: key ? 'READ_ONLY_LIVE_PROVIDER' : 'OFFLINE_STATIC_ONLY',
    provider_operations: 'GET_ONLY', paid_orders_checked: false,
    verified_external_revenue_claimed: false,
    status: !key ? 'UNVERIFIED' : results.some(r => r.status !== 'PROVIDER_LINK_MATCH') ||
      webhook.status !== 'PROVIDER_WEBHOOK_MATCH' ? 'FAIL' : 'LINK_CONTRACTS_MATCH_ONLY',
    offers: results, webhook,
    limitations: ['No Checkout Session, successful PaymentIntent, Charge, refund, independent-buyer or fulfilment verification.',
      'Stripe link and webhook parity is not production fulfilment certification or proof of revenue.'] };
  fs.mkdirSync(outputDir, { recursive: true });
  const file = path.join(outputDir, 'existing-offer-provider-parity.json');
  fs.writeFileSync(file, JSON.stringify(proof, null, 2) + '\n', { flag: 'w' });
  console.log(JSON.stringify({status:proof.status,mode:proof.mode,offer_count:results.length,
    failures:results.filter(r=>r.status!=='PROVIDER_LINK_MATCH').map(r=>({offer_id:r.offer_id,errors:r.errors})),
    webhook_status:webhook.status,proof:file},null,2));
  if (proof.status === 'FAIL') process.exitCode = 1;
  if (proof.status === 'UNVERIFIED') process.exitCode = 2;
}
run().catch(e => { console.error('READ_ONLY_PROBE_ERROR', String(e.message || e)); process.exitCode = 1; });
