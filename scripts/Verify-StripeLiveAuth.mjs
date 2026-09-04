'use strict';

const fs = require('fs');
const path = require('path');

const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
const expectedAccount = String(process.env.STRIPE_EXPECTED_ACCOUNT_ID || '').trim();
const enabled = String(process.env.STRIPE_LIVE_ENABLED || '').toLowerCase() === 'true';

const out = {
  proof_type: 'STRIPE_LIVE_AUTH_PREFLIGHT',
  checked_at: new Date().toISOString(),
  live_enabled: enabled,
  key_present: Boolean(key),
  key_prefix_ok: /^sk_live_/.test(key),
  expected_account_id: expectedAccount || null,
  account_id: null,
  account_match: false,
  auth_ok: false,
  charges_enabled: null,
  payouts_enabled: null,
  status: 'BLOCKED',
  reason: null,
  synthetic_revenue: false,
  revenue_claimed_nzd: 0
};

async function main() {
  if (!enabled) {
    out.status = 'BLOCKED';
    out.reason = 'STRIPE_LIVE_ENABLED is not true.';
  } else if (!key) {
    out.reason = 'STRIPE_SECRET_KEY is missing.';
  } else if (!/^sk_live_/.test(key)) {
    out.reason = 'STRIPE_SECRET_KEY is not a live-mode key.';
  } else {
    const response = await fetch('https://api.stripe.com/v1/account', {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` }
    });
    const text = await response.text();
    let payload = {};
    try { payload = JSON.parse(text); } catch {}
    out.account_id = payload.id || null;
    out.auth_ok = response.ok;
    out.account_match = Boolean(out.account_id && expectedAccount && out.account_id === expectedAccount);
    out.charges_enabled = typeof payload.charges_enabled === 'boolean' ? payload.charges_enabled : null;
    out.payouts_enabled = typeof payload.payouts_enabled === 'boolean' ? payload.payouts_enabled : null;

    if (!response.ok) {
      out.reason = `Stripe account authentication failed with HTTP ${response.status}.`;
    } else if (!out.account_match) {
      out.reason = 'Stripe credentials authenticated, but the account does not match the canonical DreamLedger Stripe account.';
    } else {
      out.status = 'PASS';
      out.reason = null;
    }
  }

  const dir = path.join(process.cwd(), 'proof', 'commerce');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'latest-stripe-live-auth.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));

  if (out.status !== 'PASS') process.exitCode = 1;
}

main().catch((err) => {
  out.status = 'BLOCKED';
  out.reason = err && err.message ? err.message : String(err);
  const dir = path.join(process.cwd(), 'proof', 'commerce');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'latest-stripe-live-auth.json'), JSON.stringify(out, null, 2) + '\n');
  console.error(JSON.stringify(out, null, 2));
  process.exitCode = 1;
});
