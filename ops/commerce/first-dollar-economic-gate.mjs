#!/usr/bin/env node
'use strict';

// First-dollar economic gate. Read-only against Stripe and Supabase.
// Exit 3: offer mismatch. Exit 4: payment/idempotency integrity failure.
// Exit 5: correlated fulfillment evidence failure. Exit 6: no verified independent
// live buyer (informational only). Exit 7: UNKNOWN because required evidence is unavailable.
const fs = await import('node:fs/promises');

const PRICE_ID = process.env.ACNC_STRIPE_PRICE_ID || 'price_1UKAu0EGgEAnUFF9OrBC80OU';
const PAYMENT_LINK_ID = process.env.ACNC_STRIPE_PAYMENT_LINK_ID || 'plink_1UKAu6EGgEAnUFF93oLQlZiR';
const OFFER_ID = process.env.ACNC_OFFER_ID;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const EVIDENCE_URL = process.env.SUPABASE_ECONOMIC_EVIDENCE_URL;
const report = {
  schema: 'DREAMLEDGER-FIRST-DOLLAR-GATE/v1',
  generated_at_utc: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || null,
  workflow_run: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? process.env.GITHUB_SERVER_URL + '/' + process.env.GITHUB_REPOSITORY + '/actions/runs/' + process.env.GITHUB_RUN_ID : null,
  gates: {},
  commercial: { state: 'UNVERIFIED', verified_revenue_nzd: 0, independent_buyers: 0, paid_fulfilled_orders: 0 },
  blockers: []
};
const finish = async (code, message) => {
  report.exit_code = code;
  report.decision = message;
  await fs.mkdir('proof/commerce', { recursive: true });
  await fs.writeFile('proof/commerce/latest-economic-validation.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = code;
};
const jsonFetch = async (url, options = {}) => {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  const body = await response.text();
  if (!response.ok) throw new Error('HTTP ' + response.status + ' from ' + new URL(url).host + ': ' + body.slice(0, 240));
  try { return JSON.parse(body); } catch { throw new Error('Non-JSON response from ' + new URL(url).host); }
};

try {
  if (!STRIPE_KEY || !OFFER_ID) {
    report.gates.offer_integrity = { state: 'UNKNOWN', reason: !STRIPE_KEY ? 'STRIPE_SECRET_KEY is not configured.' : 'ACNC_OFFER_ID repository variable is not configured.' };
    report.blockers.push('Configure required GitHub Actions secret/variable; never put secrets in repository files.');
    await finish(7, 'UNKNOWN: required Stripe credentials or canonical offer identity unavailable.');
  } else {
    const stripeHeaders = { Authorization: 'Bearer ' + STRIPE_KEY };
    const price = await jsonFetch('https://api.stripe.com/v1/prices/' + encodeURIComponent(PRICE_ID), { headers: stripeHeaders });
    const link = await jsonFetch('https://api.stripe.com/v1/payment_links/' + encodeURIComponent(PAYMENT_LINK_ID), { headers: stripeHeaders });
    const priceOk = price.id === PRICE_ID && price.unit_amount === 9900 && price.currency === 'nzd' && price.livemode === true && price.active === true;
    const metadata = link.metadata || {};
    const metadataOk = metadata.offer_id === OFFER_ID && String(metadata.price_nzd ?? '') === '99';
    report.gates.offer_integrity = {
      state: priceOk && metadataOk ? 'PASS' : 'FAIL',
      price: { id: price.id, unit_amount: price.unit_amount, currency: price.currency, livemode: price.livemode, active: price.active },
      payment_link: { id: link.id, active: link.active, metadata_offer_id_present: Boolean(metadata.offer_id), metadata_price_nzd_present: metadata.price_nzd !== undefined && metadata.price_nzd !== null },
      expected: { price_id: PRICE_ID, unit_amount: 9900, currency: 'nzd', livemode: true, active: true, offer_id: OFFER_ID, price_nzd: '99' }
    };
    if (!priceOk || !metadataOk || link.active !== true) {
      report.blockers.push('ACNC offer identity, live Price fields, active Payment Link, and canonical Payment Link metadata must all match exactly.');
      await finish(3, 'OFFER_MISMATCH: live offer contract did not match.');
    } else {
      // Supabase public status is only a preliminary signal. Direct project health and
      // correlated evidence are also required; public status alone never proves readiness.
      const status = await jsonFetch('https://status.supabase.com/api/v2/status.json');
      const indicator = status?.status?.indicator;
      if (indicator !== 'none' || !SUPABASE_URL || !SUPABASE_ANON_KEY || !EVIDENCE_URL) {
        report.gates.supabase_availability = { state: 'UNKNOWN', status_indicator: indicator || 'unavailable', direct_health: 'NOT_CHECKED', evidence_probe: 'NOT_CONFIGURED' };
        report.blockers.push('Supabase status must be operational and SUPABASE_URL, SUPABASE_ANON_KEY (or service role key), and SUPABASE_ECONOMIC_EVIDENCE_URL must be configured.');
        await finish(7, 'UNKNOWN: Supabase availability or evidence source cannot be verified.');
      } else {
        try {
          await jsonFetch(SUPABASE_URL + '/auth/v1/health', { headers: { apikey: SUPABASE_ANON_KEY } });
          const evidence = await jsonFetch(EVIDENCE_URL, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY } });
          report.gates.supabase_availability = { state: 'PASS', status_indicator: indicator, direct_health: 'PASS', evidence_probe: 'REACHABLE' };
          const paymentOk = evidence?.schema === 'DREAMLEDGER-ECONOMIC-EVIDENCE/v1'
            && evidence?.webhook_event_id_unique_constraint === true
            && evidence?.webhook_event?.event_id
            && evidence?.webhook_event?.client_reference_id === evidence?.client_reference_id
            && evidence?.revenue_order?.client_reference_id === evidence?.client_reference_id
            && evidence?.fulfillment_request?.client_reference_id === evidence?.client_reference_id;
          report.gates.payment_integrity = {
            state: paymentOk ? 'PASS' : 'FAIL',
            client_reference_id: evidence?.client_reference_id || null,
            event_id_unique_constraint: evidence?.webhook_event_id_unique_constraint === true,
            webhook_correlated: Boolean(evidence?.webhook_event?.event_id && evidence?.webhook_event?.client_reference_id === evidence?.client_reference_id),
            revenue_order_correlated: Boolean(evidence?.revenue_order?.client_reference_id === evidence?.client_reference_id),
            fulfillment_request_correlated: Boolean(evidence?.fulfillment_request?.client_reference_id === evidence?.client_reference_id)
          };
          if (!paymentOk) {
            report.blockers.push('Payment integrity failed: unique event_id constraint or same-client_reference_id webhook/order/fulfillment correlation is missing.');
            await finish(4, 'PAYMENT_INTEGRITY_FAILURE: attribution or replay-safe evidence is incomplete.');
          } else {
            const reportArtifact = evidence?.report;
            const delivery = evidence?.delivery_receipt;
            const shaOk = typeof reportArtifact?.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(reportArtifact.sha256);
            const timestampOk = Number.isFinite(Date.parse(reportArtifact?.generated_at_utc || ''));
            const deliveryOk = delivery?.client_reference_id === evidence.client_reference_id
              && delivery?.artifact_sha256 === reportArtifact?.sha256
              && Number.isFinite(Date.parse(delivery?.accepted_at_utc || ''))
              && Number.isFinite(Date.parse(delivery?.confirmed_at_utc || ''));
            const fulfillmentOk = evidence?.fulfillment_request?.state === 'delivered' && shaOk && timestampOk && deliveryOk;
            report.gates.fulfillment_integrity = {
              state: fulfillmentOk ? 'PASS' : 'FAIL',
              report_sha256_valid: shaOk,
              report_generation_timestamp_valid: timestampOk,
              delivery_receipt_correlated: deliveryOk,
              fulfillment_state: evidence?.fulfillment_request?.state || 'UNKNOWN'
            };
            if (!fulfillmentOk) {
              report.blockers.push('Fulfillment failed: same-transaction report hash, generation timestamp, delivered state, and timestamped matching delivery receipt are required.');
              await finish(5, 'FULFILLMENT_FAILURE: complete correlated delivery evidence is missing.');
            } else {
              const independentBuyer = evidence?.commercial?.independent_live_buyer_complete === true;
              report.commercial = {
                state: independentBuyer ? 'VERIFIED' : 'UNVERIFIED',
                verified_revenue_nzd: independentBuyer ? Number(evidence.commercial.settled_revenue_nzd || 0) : 0,
                independent_buyers: independentBuyer ? Number(evidence.commercial.independent_buyers || 0) : 0,
                paid_fulfilled_orders: independentBuyer ? Number(evidence.commercial.paid_fulfilled_orders || 0) : 0,
                informational_only: true
              };
              if (!independentBuyer) {
                report.blockers.push('No independently verified live buyer has completed the full chain; this is commercial information, not a technical gate failure.');
                await finish(6, 'TECHNICAL_GATES_PASS; COMMERCIAL_EVIDENCE_UNVERIFIED (informational).');
              } else {
                await finish(0, 'TECHNICAL_GATES_PASS; commercial claim reflects only supplied independently verified evidence.');
              }
            }
          }
        } catch (error) {
          report.gates.supabase_availability = { state: 'UNKNOWN', reason: String(error.message || error).slice(0, 400) };
          report.blockers.push('Supabase health/evidence query failed. UNKNOWN is fail-closed; no missing evidence may be treated as PASS.');
          await finish(7, 'UNKNOWN: Supabase or correlated economic evidence unavailable.');
        }
      }
    }
  }
} catch (error) {
  report.gates.offer_integrity = { state: 'UNKNOWN', reason: String(error.message || error).slice(0, 400) };
  report.blockers.push('Stripe Price or Payment Link could not be verified directly.');
  await finish(7, 'UNKNOWN: live offer evidence unavailable.');
}
