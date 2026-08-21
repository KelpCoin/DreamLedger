'use strict';

const { verifyEvidenceChain } = require('../lib/mvpPolicy');

async function main() {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!base || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const response = await fetch(base + '/rest/v1/dreamledger_evidence?select=*&order=sequence.asc', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  if (!response.ok) throw new Error('Evidence query failed with HTTP ' + response.status);
  const events = await response.json();
  const result = verifyEvidenceChain(events);
  console.log(JSON.stringify({ status: result.ok ? 'PASS' : 'FAIL', ...result }, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch(error => { console.error('FAIL:', error.message); process.exitCode = 1; });
