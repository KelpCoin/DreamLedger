#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const CONTRACT = path.join(ROOT, 'MAXIMONA', 'EXPERIMENT-001.json');
const PROSPECT = path.join(ROOT, 'MAXIMONA', 'PROSPECT-001-UPWORK.md');
const OUT = process.env.MAXIMONA_PROOF_DIR || path.join(process.env.MAXIMONA_DATA_ROOT || 'D:\\BrownEyeCortex', 'Maximona', 'Experiment001');

function sha256(s) { return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex'); }
function exists(p) { return fs.existsSync(p); }
function read(p) { return fs.readFileSync(p, 'utf8'); }
function check(name, ok, detail) { return { name, ok: Boolean(ok), detail }; }

async function main() {
  const checks = [];
  checks.push(check('experiment_contract', exists(CONTRACT), CONTRACT));
  checks.push(check('prospect_queue', exists(PROSPECT), PROSPECT));

  let contract = null;
  if (exists(CONTRACT)) {
    try { contract = JSON.parse(read(CONTRACT)); checks.push(check('contract_json', true, contract.schema_version)); }
    catch (e) { checks.push(check('contract_json', false, e.message)); }
  }

  if (contract) {
    checks.push(check('sample_size', contract.sample_size === 10, String(contract.sample_size)));
    checks.push(check('combined_price', contract.offer && contract.offer.combined_supabase_stripe_nzd === 1500, String(contract.offer && contract.offer.combined_supabase_stripe_nzd)));
    checks.push(check('discount_disabled', contract.offer && contract.offer.discount_tier === false, String(contract.offer && contract.offer.discount_tier)));
    checks.push(check('revenue_zero_until_settled', contract.verified_revenue_nzd === 0, String(contract.verified_revenue_nzd)));
  }

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

  const proof = {
    schema_version: 'MAXIMONA-001-PROOF/1.0',
    generated_at: new Date().toISOString(),
    experiment_id: 'MAXIMONA-001',
    contract_sha256: exists(CONTRACT) ? sha256(read(CONTRACT)) : null,
    prospect_sha256: exists(PROSPECT) ? sha256(read(PROSPECT)) : null,
    supabase_observation: supabase,
    checks,
    overall: checks.every(c => c.ok) ? 'PASS' : 'INCOMPLETE_OR_UNVERIFIED'
  };

  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, 'MAXIMONA-001-proof-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(file, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
  console.log('PROOF_FILE=' + file);
  process.exitCode = proof.overall === 'PASS' ? 0 : 2;
}

main().catch((e) => { console.error('MAXIMONA_VERIFY_FATAL=' + e.message); process.exitCode = 3; });
