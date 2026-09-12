#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const CONTRACT = path.join(ROOT, 'MAXIMONA', 'EXPERIMENT-001.json');
const STRIPE_CONTRACT = path.join(ROOT, 'MAXIMONA', 'STRIPE-OFFER-CONTRACT.json');
const PROSPECT = path.join(ROOT, 'MAXIMONA', 'PROSPECT-001-UPWORK.md');
const OUT = process.env.MAXIMONA_PROOF_DIR || path.join(process.env.MAXIMONA_DATA_ROOT || 'D:\\BrownEyeCortex', 'Maximona', 'Experiment001');
const STRIPE_OBSERVATION = process.env.MAXIMONA_STRIPE_OBSERVATION || '';

function sha256(s) { return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex'); }
function exists(p) { return fs.existsSync(p); }
function read(p) { return fs.readFileSync(p, 'utf8'); }
function check(name, ok, detail) { return { name, ok: Boolean(ok), detail }; }
function loadJson(p) {
  try { return { value: JSON.parse(read(p)), error: null }; }
  catch (e) { return { value: null, error: e.message }; }
}

async function main() {
  const checks = [];
  checks.push(check('experiment_contract', exists(CONTRACT), CONTRACT));
  checks.push(check('stripe_offer_contract', exists(STRIPE_CONTRACT), STRIPE_CONTRACT));
  checks.push(check('prospect_queue', exists(PROSPECT), PROSPECT));

  let contract = null;
  if (exists(CONTRACT)) {
    const parsed = loadJson(CONTRACT);
    if (parsed.value) { contract = parsed.value; checks.push(check('contract_json', true, contract.schema_version)); }
    else checks.push(check('contract_json', false, parsed.error));
  }

  let stripeContract = null;
  if (exists(STRIPE_CONTRACT)) {
    const parsed = loadJson(STRIPE_CONTRACT);
    if (parsed.value) { stripeContract = parsed.value; checks.push(check('stripe_offer_contract_json', true, stripeContract.schema_version)); }
    else checks.push(check('stripe_offer_contract_json', false, parsed.error));
  }

  if (contract) {
    checks.push(check('sample_size', contract.sample_size === 10, String(contract.sample_size)));
    checks.push(check('combined_price', contract.offer && contract.offer.combined_supabase_stripe_nzd === 1500, String(contract.offer && contract.offer.combined_supabase_stripe_nzd)));
    checks.push(check('discount_disabled', contract.offer && contract.offer.discount_tier === false, String(contract.offer && contract.offer.discount_tier)));
    checks.push(check('revenue_zero_until_settled', contract.verified_revenue_nzd === 0, String(contract.verified_revenue_nzd)));
    checks.push(check('buyer_hypothesis_present', typeof contract.buyer_hypothesis === 'string' && contract.buyer_hypothesis.length > 0, 'required before bridge proof'));
    checks.push(check('bridge_atom_present', Boolean(contract.bridge_atom && contract.bridge_atom.name), String(contract.bridge_atom && contract.bridge_atom.name)));
  }

  if (stripeContract) {
    checks.push(check('stripe_sku', stripeContract.sku === 'MAXIMONA-IPV-001', String(stripeContract.sku)));
    checks.push(check('stripe_product_id_present', /^prod_/.test(String(stripeContract.product_id)), String(stripeContract.product_id)));
    checks.push(check('stripe_price_id_present', /^price_/.test(String(stripeContract.price_id)), String(stripeContract.price_id)));
    checks.push(check('stripe_payment_link_id_present', /^plink_/.test(String(stripeContract.payment_link_id)), String(stripeContract.payment_link_id)));
    checks.push(check('stripe_price_nzd', stripeContract.currency === 'nzd' && stripeContract.unit_amount === 150000 && stripeContract.price_nzd === 1500, JSON.stringify({ currency: stripeContract.currency, unit_amount: stripeContract.unit_amount, price_nzd: stripeContract.price_nzd })));
    checks.push(check('stripe_one_time', stripeContract.billing_type === 'one_time', String(stripeContract.billing_type)));
    checks.push(check('stripe_revenue_truth', stripeContract.revenue_truth === 'settled_stripe_payment_from_real_external_buyer' && stripeContract.verified_revenue_nzd === 0, JSON.stringify({ revenue_truth: stripeContract.revenue_truth, verified_revenue_nzd: stripeContract.verified_revenue_nzd })));
  }

  const runtime = { status: 'NOT_RUN', reason: 'No quarantined test-mode transaction observation artifact supplied.' };
  if (STRIPE_OBSERVATION) {
    if (!exists(STRIPE_OBSERVATION)) {
      runtime.status = 'CONTRADICTED';
      runtime.reason = 'MAXIMONA_STRIPE_OBSERVATION points to a missing file.';
    } else {
      const parsed = loadJson(STRIPE_OBSERVATION);
      if (!parsed.value) {
        runtime.status = 'CONTRADICTED';
        runtime.reason = parsed.error;
      } else {
        const o = parsed.value;
        const expected = stripeContract || {};
        const identity = o.checkout_session_metadata || {};
        const intent = o.payment_intent_metadata || {};
        const charge = o.charge_metadata || {};
        const same = (a, b) => String(a || '') === String(b || '');
        const ok = Boolean(
          o.mode === 'test' &&
          o.transaction_quarantined === true &&
          same(identity.silo, expected.silo) &&
          same(identity.experiment, expected.experiment) &&
          same(intent.silo, expected.silo) &&
          same(intent.experiment, expected.experiment) &&
          same(charge.silo, expected.silo) &&
          same(charge.experiment, expected.experiment)
        );
        runtime.status = ok ? 'PASS' : 'CONTRADICTED';
        runtime.reason = ok ? 'Test-mode transaction metadata propagated through Checkout Session, Payment Intent and Charge.' : 'Runtime propagation did not match the Maximona CUBE identity contract.';
        runtime.observation_sha256 = sha256(read(STRIPE_OBSERVATION));
      }
    }
  }
  checks.push(check('runtime_transaction_propagation', runtime.status === 'PASS', JSON.stringify(runtime)));

  let supabase = { status: 'UNVERIFIED' };
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (base && key) {
    try {
      const r = await fetch(base + '/rest/v1/agent_bridge_auth?select=singleton,updated_at', {
        headers: { apikey: key, Authorization: 'Bearer ' + key },
        signal: AbortSignal.timeout(15000)
      });
      const text = await r.text();
      supabase = { status: r.ok ? 'REACHABLE' : 'CONTRADICTED', http_status: r.status, body_sha256: sha256(text) };
    } catch (e) {
      supabase = { status: 'CONNECTIVITY_FAILURE', error: e.message };
    }
  } else {
    supabase = { status: 'NOT_CONFIGURED', supabase_url: Boolean(base), service_key: Boolean(key) };
  }
  checks.push(check('supabase_bridge_observation', supabase.status === 'REACHABLE', JSON.stringify(supabase)));

  const configurationChecks = checks.filter(c => c.name !== 'runtime_transaction_propagation');
  const configurationPass = configurationChecks.every(c => c.ok);
  const runtimePass = runtime.status === 'PASS';
  const proof = {
    schema_version: 'MAXIMONA-001-PROOF/1.1',
    generated_at: new Date().toISOString(),
    experiment_id: 'MAXIMONA-001',
    verification_scope: 'configuration_and_control_plane',
    explicit_limit: 'This verifier proves configured offer objects and control-plane reachability. It does not claim transaction capability or runtime metadata propagation unless a quarantined test-mode transaction observation is supplied.',
    contract_sha256: exists(CONTRACT) ? sha256(read(CONTRACT)) : null,
    stripe_offer_contract_sha256: exists(STRIPE_CONTRACT) ? sha256(read(STRIPE_CONTRACT)) : null,
    prospect_sha256: exists(PROSPECT) ? sha256(read(PROSPECT)) : null,
    stripe_runtime_observation: runtime,
    supabase_observation: supabase,
    checks,
    configuration_status: configurationPass ? 'PASS' : 'INCOMPLETE_OR_UNVERIFIED',
    runtime_status: runtimePass ? 'PASS' : 'UNVERIFIED',
    overall: configurationPass && runtimePass ? 'PASS_CONFIGURATION_AND_RUNTIME' : configurationPass ? 'PASS_CONFIGURATION_ONLY_RUNTIME_UNVERIFIED' : 'INCOMPLETE_OR_UNVERIFIED'
  };

  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, 'MAXIMONA-001-proof-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(file, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
  console.log('PROOF_FILE=' + file);
  process.exitCode = configurationPass ? 0 : 2;
}

main().catch((e) => { console.error('MAXIMONA_VERIFY_FATAL=' + e.message); process.exitCode = 3; });
