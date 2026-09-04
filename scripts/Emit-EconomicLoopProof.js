'use strict';
const fs = require('fs');
const path = require('path');
const dir = path.join(process.cwd(), 'proof', 'commerce');
fs.mkdirSync(dir, { recursive: true });
const recon = path.join(dir, 'latest-stripe-airtable-reconciliation.json');
let out;
if (fs.existsSync(recon)) {
  const source = JSON.parse(fs.readFileSync(recon, 'utf8'));
  out = {
    schema: 'dreamledger-economic-loop-v1',
    generated_at: new Date().toISOString(),
    authority: source.authority,
    verified_revenue_nzd: source.verified_revenue_nzd,
    newly_recognized_events: source.newly_recognized_events,
    matching_paid_sessions: source.matching_paid_sessions,
    scanned_completed_checkout_sessions: source.scanned_completed_checkout_sessions,
    loop: 'payment -> reconciliation -> offer-specific fulfillment -> human delivery evidence -> next monetization candidate',
    public_posting: 'DISABLED',
    synthetic_revenue: false,
    status: 'RECONCILIATION_PASS'
  };
} else {
  out = {
    schema: 'dreamledger-economic-loop-v1',
    generated_at: new Date().toISOString(),
    authority: 'Stripe live payment evidence',
    verified_revenue_nzd: 0,
    newly_recognized_events: [],
    matching_paid_sessions: null,
    scanned_completed_checkout_sessions: null,
    loop: 'payment -> reconciliation -> offer-specific fulfillment -> human delivery evidence -> next monetization candidate',
    public_posting: 'DISABLED',
    synthetic_revenue: false,
    status: 'RECONCILIATION_BLOCKED',
    reason: 'Stripe reconciliation did not produce a reconciliation proof file.'
  };
}
const outPath = path.join(dir, 'latest-economic-loop.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
