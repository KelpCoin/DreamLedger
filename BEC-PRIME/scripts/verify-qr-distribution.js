'use strict';

const fs = require('fs');
const path = require('path');
const { verifyQRAsset } = require('../gauntlet/QRAssetGauntlet');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function supabaseRequest(endpoint) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const response = await fetch(`${SUPABASE_URL}${endpoint}`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : [];
}

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error('Usage: node BEC-PRIME/scripts/verify-qr-distribution.js <context.json> [proof.json]');
  const context = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
  const result = await verifyQRAsset(context.asset || {}, context, supabaseRequest);
  const proofPath = process.argv[3];
  if (proofPath) {
    fs.mkdirSync(path.dirname(path.resolve(proofPath)), { recursive: true });
    fs.writeFileSync(path.resolve(proofPath), JSON.stringify({ type: 'dreamledger-qr-distribution-proof', version: '1.0', checked_at: new Date().toISOString(), ...result }, null, 2) + '\n', 'utf8');
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'PASS' ? 0 : 1);
}

main().catch(error => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }, null, 2));
  process.exit(1);
});
