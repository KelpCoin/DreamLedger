'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-mtgdiag-'));
process.env.MTG_DIAGNOSTIC_DATA_DIR = tempDir;
process.env.STRIPE_SECRET_KEY = 'mocked_stripe_secret_for_unit_tests';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
const d = require('../lib/mtgDiagnosticFulfillment');

async function main() {
  const deck = Array.from({length:35}, (_,i) => `1 Test Card ${i+1}`).join('\n');
  const parsed = d.parseDecklist(deck);
  const validCheckout = {livemode:true,amount_total:2900,currency:'nzd',metadata:{product_id:'COMMANDER-DECK-DIAGNOSTIC-001',offer_id:'OFFER-CMD-DIAG-29-NZD',sku:'CMD-DIAG-29',intake_id:'intake-test'}};
  assert.equal(d.assertCheckoutSessionContract(validCheckout,'intake-test'),true);
  assert.throws(() => d.assertCheckoutSessionContract({...validCheckout,amount_total:40000},'intake-test'), /amount_must_equal_NZD_29/);
  assert.throws(() => d.assertCheckoutSessionContract({...validCheckout,livemode:false},'intake-test'), /live_mode_required/);
  assert.throws(() => d.assertCheckoutSessionContract({...validCheckout,currency:'usd'},'intake-test'), /currency_must_be_NZD/);
  assert.throws(() => d.assertCheckoutSessionContract({...validCheckout,metadata:{...validCheckout.metadata,product_id:'OTHER'}},'intake-test'), /product_id_mismatch/);
  assert.throws(() => d.assertCheckoutSessionContract({...validCheckout,metadata:{...validCheckout.metadata,offer_id:'OTHER'}},'intake-test'), /offer_id_mismatch/);
  assert.throws(() => d.assertCheckoutSessionContract({...validCheckout,metadata:{...validCheckout.metadata,sku:'OTHER'}},'intake-test'), /sku_mismatch/);
  assert.throws(() => d.assertCheckoutSessionContract({...validCheckout,metadata:{...validCheckout.metadata,intake_id:'OTHER'}},'intake-test'), /intake_id_mismatch/);
  assert.strictEqual(parsed.length,35);
  const metrics = d.classify([
    {name:'Sol Ring',qty:1},
    {name:'Arcane Signet',qty:1},
    {name:'Command Tower',qty:1},
    {name:'Forest',qty:1},
    {name:'Counterspell',qty:1}
  ]);
  assert.strictEqual(metrics.ramp,2);
  assert.strictEqual(metrics.lands,2);
  assert.strictEqual(metrics.removal,1);

  // Economic fail-closed contract: no checkout session or intake artifact may
  // be created while the settlement ledger cannot record the resulting order.
  await assert.rejects(
    d.createCheckout({decklist:deck}),
    /Economic ledger unavailable; checkout held/
  );
  assert.deepStrictEqual(fs.readdirSync(tempDir), []);

  console.log(JSON.stringify({
    status:'PASS',
    test:'mtg-diagnostic-contract',
    parsed_cards:parsed.length,
    metrics,
    checkout_contract_amount_currency_sku_livemode:'PASS',
    checkout_without_economic_ledger:'BLOCKED_AS_REQUIRED',
    intake_artifacts_created:0
  },null,2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  fs.rmSync(tempDir,{recursive:true,force:true});
});
