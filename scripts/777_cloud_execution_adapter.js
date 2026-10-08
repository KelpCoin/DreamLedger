'use strict';

/*
 * DreamLedger 777 Cloud Elohim / Cloud Gauntlet execution adapter.
 *
 * This is an adapter, not a new ledger/queue/orchestrator.
 * It consumes an existing 777 signal/candidate, asks an available intelligence
 * surface for bounded decisions, runs the existing CandidateGauntlet, and emits
 * one durable execution receipt.
 *
 * Five ordered fallbacks:
 * 1. CLOUD_ELOHIM_URL + CLOUD_GAUNTLET_URL
 * 2. VERCEL_AI_GATEWAY_URL (OpenAI-compatible JSON endpoint)
 * 3. ELOHIM_FALLBACK_URL + GAUNTLET_FALLBACK_URL
 * 4. LM_STUDIO_URL (local OpenAI-compatible endpoint)
 * 5. Existing deterministic CandidateGauntlet + FactoryFactory, with no model claim
 *
 * No path may spend, contact a buyer, publish externally, mutate credentials,
 * or claim revenue. Those remain behind the existing authority/economic gates.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { run: runGauntlet } = require('../BEC-PRIME/gauntlet/CandidateGauntlet');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'webapp', 'pulse');
const RECEIPT = path.join(OUT_DIR, '777-cloud-execution-receipt.json');

function sha(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function now() {
  return new Date().toISOString();
}

function readInput() {
  const supplied = process.env.DREAMLEDGER_777_INPUT;
  if (supplied && fs.existsSync(supplied)) return JSON.parse(fs.readFileSync(supplied, 'utf8'));

  const latest = fs.readdirSync(OUT_DIR, { withFileTypes: true })
    .filter(x => x.isFile() && /private-commercial-.*\.html$/.test(x.name))
    .map(x => x.name)
    .sort()
    .pop();

  return latest
    ? { source_file: path.join(OUT_DIR, latest), objective: 'find one bounded monetizable decision' }
    : { objective: 'find one bounded monetizable decision' };
}

function candidateFromModel(modelOutput, source) {
  const x = typeof modelOutput === 'string' ? { decision: modelOutput } : (modelOutput || {});
  return {
    offer_id: x.offer_id || 'QUOTE-COMPARE-49',
    name: x.name || 'Signed Quote Comparison',
    problem: x.problem || x.decision || 'Compare supplier quotations and identify the economically superior comparable option.',
    target_buyer: x.target_buyer || 'buyer with 2-5 supplier quotes',
    deliverable: x.deliverable || 'normalized comparison, ranking, missing-scope findings, source evidence and signed verification packet',
    delivery_mechanism: x.delivery_mechanism || 'existing quote comparison fulfillment rail',
    price: Number(x.price || 49),
    currency: x.currency || 'NZD',
    payment_adapter: x.payment_adapter || 'existing Stripe checkout',
    checkout_route: x.checkout_route || process.env.QUOTE_COMPARE_CHECKOUT || 'configured existing Quote Compare checkout',
    approval_required: true,
    checkout_available: false,
    status: 'CANDIDATE',
    proof_of_delivery: x.proof_of_delivery || 'signed/hash-bound evidence packet plus independent verification',
    verification_rules: x.verification_rules || 'external buyer + settled payment + fulfillment + independent proof',
    provenance: { private_material: 'excluded', source_hash: sha(JSON.stringify(source)) },
    silo: x.silo || 'quote-compare',
    kill_condition: x.kill_condition || 'no external buyer, no settled payment, fulfillment failure, contradictory evidence'
  };
}

async function postJson(url, body, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await r.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!r.ok) throw new Error('HTTP_' + r.status);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function attempt(name, fn, attempts) {
  try {
    const output = await fn();
    attempts.push({ path: name, status: 'PASS', at: now() });
    return { name, output };
  } catch (error) {
    attempts.push({ path: name, status: 'FAIL', error: String(error.message || error), at: now() });
    return null;
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const source = readInput();
  const attempts = [];
  let selected = null;
  let candidate;
  let model_claim = 'NONE';

  if (process.env.CLOUD_ELOHIM_URL && process.env.CLOUD_GAUNTLET_URL) {
    selected = await attempt('1:CLOUD_ELOHIM_PLUS_CLOUD_GAUNTLET', async () => {
      const elo = await postJson(process.env.CLOUD_ELOHIM_URL, {
        role: 'ELOHIM',
        objective: 'Produce bounded economic decisions using only existing DreamLedger rails.',
        source,
        constraints: ['no new ledger', 'no autonomous external contact', 'no spending', 'no fake proof', 'existing offers first'],
        max_decisions: 5
      });
      const c = candidateFromModel(elo.decisions?.[0] || elo, source);
      const g = await postJson(process.env.CLOUD_GAUNTLET_URL, {
        role: 'GAUNTLET',
        candidate: c,
        constraints: ['reject missing buyer', 'reject missing settlement path', 'reject missing fulfillment proof', 'approval_required=true']
      });
      return { elo, gauntlet: g, candidate: c };
    }, attempts);
    if (selected) { candidate = selected.output.candidate; model_claim = 'CLOUD_ELOHIM+CLOUD_GAUNTLET'; }
  }

  if (!selected && process.env.VERCEL_AI_GATEWAY_URL) {
    selected = await attempt('2:VERCEL_AI_GATEWAY', async () => {
      const r = await postJson(process.env.VERCEL_AI_GATEWAY_URL, {
        model: process.env.VERCEL_AI_MODEL || 'configured-model',
        messages: [{
          role: 'system',
          content: 'Act as DreamLedger Elohim. Produce one bounded monetizable decision using existing offers only. Never invent buyers, payments, or proof.'
        }, { role: 'user', content: JSON.stringify(source) }]
      });
      const c = candidateFromModel(r.output || r.choices?.[0]?.message?.content || r, source);
      return { gateway: r, candidate: c };
    }, attempts);
    if (selected) { candidate = selected.output.candidate; model_claim = 'VERCEL_AI_GATEWAY'; }
  }

  if (!selected && process.env.ELOHIM_FALLBACK_URL && process.env.GAUNTLET_FALLBACK_URL) {
    selected = await attempt('3:CONFIGURED_ELOHIM_GAUNTLET_FALLBACK', async () => {
      const elo = await postJson(process.env.ELOHIM_FALLBACK_URL, { source, max_decisions: 5 });
      const c = candidateFromModel(elo.decisions?.[0] || elo, source);
      const g = await postJson(process.env.GAUNTLET_FALLBACK_URL, { candidate: c });
      return { elo, gauntlet: g, candidate: c };
    }, attempts);
    if (selected) { candidate = selected.output.candidate; model_claim = 'CONFIGURED_FALLBACK'; }
  }

  if (!selected && process.env.LM_STUDIO_URL) {
    selected = await attempt('4:LM_STUDIO_OPENAI_COMPATIBLE', async () => {
      const r = await postJson(process.env.LM_STUDIO_URL, {
        model: process.env.LM_STUDIO_MODEL || 'configured-local-model',
        messages: [{
          role: 'system',
          content: 'Produce one bounded DreamLedger economic candidate. Existing offers only. No buyer/payment/proof claims.'
        }, { role: 'user', content: JSON.stringify(source) }]
      });
      const c = candidateFromModel(r.choices?.[0]?.message?.content || r.output || r, source);
      return { lm_studio: r, candidate: c };
    }, attempts);
    if (selected) { candidate = selected.output.candidate; model_claim = 'LM_STUDIO'; }
  }

  if (!selected) {
    selected = await attempt('5:DETERMINISTIC_EXISTING_GAUNTLET', async () => {
      const c = candidateFromModel({}, source);
      return { candidate: c, deterministic: true };
    }, attempts);
    candidate = selected.output.candidate;
    model_claim = 'DETERMINISTIC_FALLBACK';
  }

  const candidatePath = path.join(OUT_DIR, '777-cloud-execution-candidate.json');
  const proofPath = path.join(OUT_DIR, '777-cloud-gauntlet-proof.json');
  fs.writeFileSync(candidatePath, JSON.stringify(candidate, null, 2) + '\n');

  let gauntlet;
  try {
    gauntlet = runGauntlet(candidate, proofPath);
  } catch (error) {
    gauntlet = { status: 'FAIL', error: String(error.message || error) };
  }

  const receipt = {
    schema_version: 'DREAMLEDGER/777/CLOUD-EXECUTION/v1',
    generated_at_utc: now(),
    selected_path: model_claim,
    fallback_attempts: attempts,
    candidate_hash: sha(JSON.stringify(candidate)),
    gauntlet_status: gauntlet.status || 'UNKNOWN',
    candidate,
    authority: {
      external_contact: 'BLOCKED',
      spend: 'BLOCKED',
      charge: 'BLOCKED',
      credential_mutation: 'BLOCKED',
      checkout_publication: 'BLOCKED',
      revenue_claim: 'TRUTH_ORACLE_ONLY'
    },
    economic_truth: {
      buyer: false,
      settled_payment: false,
      fulfillment: false,
      independent_proof: false,
      revenue: 'UNVERIFIED'
    },
    next_action: gauntlet.status === 'PASS'
      ? 'route only through existing authorized acquisition/commerce mechanism'
      : 'retain candidate internally and generate next bounded candidate'
  };

  receipt.integrity_sha256 = sha(JSON.stringify(receipt));
  fs.writeFileSync(RECEIPT, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({
    status: 'PASS',
    selected_path: model_claim,
    gauntlet_status: receipt.gauntlet_status,
    revenue: receipt.economic_truth.revenue,
    receipt: RECEIPT
  }, null, 2));
}

main().catch(error => {
  console.error(String(error.stack || error));
  process.exit(1);
});
