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

  // Canonical product gate must reject before touching checkout or intake storage.
  // The source SKU is held, so this test proves that hold cannot be bypassed.
  await assert.rejects(
    d.createCheckout({decklist:deck}),
    /CANONICAL_PRODUCT_HELD: checkout remains disabled/
  );
  assert.deepStrictEqual(fs.readdirSync(tempDir), []);

  console.log(JSON.stringify({
    status:'PASS',
    test:'mtg-diagnostic-contract',
    parsed_cards:parsed.length,
    metrics,
    checkout_with_canonical_product_held:'BLOCKED_AS_REQUIRED',
    intake_artifacts_created:0
  },null,2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  fs.rmSync(tempDir,{recursive:true,force:true});
});
