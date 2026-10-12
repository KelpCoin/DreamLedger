import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'gauntlet-economic-verdict.mjs');

function runGauntlet(fixtures = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-commercial-gauntlet-'));
  try {
    const proofDir = path.join(cwd, 'proof', 'commerce');
    fs.mkdirSync(proofDir, { recursive: true });
    for (const [name, value] of Object.entries(fixtures)) {
      fs.writeFileSync(path.join(proofDir, name), JSON.stringify(value, null, 2));
    }
    const result = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' });
    const verdictPath = path.join(proofDir, 'latest-gauntlet-economic-verdict.json');
    assert.ok(fs.existsSync(verdictPath), 'Gauntlet must always write a durable verdict artifact');
    return { ...result, verdict: JSON.parse(fs.readFileSync(verdictPath, 'utf8')) };
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

test('missing evidence fails closed and never invents revenue', () => {
  const result = runGauntlet();
  assert.equal(result.status, 2, 'missing commercial evidence must not pass the economic gate');
  assert.equal(result.verdict.verdict, 'BLOCKED_PENDING_FIRST_PAID_ORDER_AND_FULFILLMENT_PROOF');
  assert.equal(result.verdict.score_out_of_100, 0);
  assert.equal(result.verdict.economic_baseline.verified_business_revenue_nzd, 0);
  assert.equal(result.verdict.economic_baseline.bank_payout_or_net_profit_verified, false);
});

test('a paid-session signal alone cannot pass buyer attribution, fulfillment, or delivery laws', () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const result = runGauntlet({
    'latest-monetization-scout.json': {
      generated_at_utc: future,
      recommended_first_dollar_path: { offer: 'TRUTH-ORACLE-ACCESS-001' }
    },
    'latest-economic-validation.json': {
      run_started_at_utc: new Date().toISOString(),
      checks: [
        { name: 'commercial.truth_oracle_offer_parity', status: 'PASS' },
        { name: 'offer.retired_offer_retirement', status: 'PASS' },
        { name: 'offer.truth_oracle_checkout_hold', status: 'PASS' }
      ]
    },
    'latest-first-dollar-stripe-reconciliation.json': {
      generated_at_utc: future,
      offer: { checkout_enabled: true },
      live_stripe: {
        exact_payment_link_found: true,
        payment_link_active: true,
        exact_paid_live_sessions: [{ session_id: 'TEST-FIXTURE-NOT-LIVE-EVIDENCE' }],
        offer_checkout_funnel: { sessions_started_for_exact_payment_link: 1 }
      }
    }
  });
  assert.equal(result.status, 2, 'a payment signal without attributable buyer and delivery proof must not pass');
  assert.equal(result.verdict.verdict, 'PAYMENT_SIGNAL_ONLY_DO_NOT_SCALE_UNTIL_FULFILLMENT_AND_DEMAND_PASS');
  assert.equal(result.verdict.economic_baseline.verified_business_revenue_nzd, 0);
  assert.equal(result.verdict.economic_baseline.verified_fulfillment, false);
  assert.equal(result.verdict.economic_baseline.verified_delivery, false);
  assert.ok(result.verdict.hard_laws.some(x => x.id === 'C4' && x.verdict !== 'PASS'));
  assert.ok(result.verdict.hard_laws.some(x => x.id === 'C5' && x.verdict !== 'PASS'));
  assert.ok(result.verdict.hard_laws.some(x => x.id === 'C6' && x.verdict !== 'PASS'));
});
