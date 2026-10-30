'use strict';
// Fail-closed cloud runner credential presence gate. Never print secret values.
const fs = require('node:fs');
const path = require('node:path');
const choices = Object.freeze({ stripe: 'STRIPE_SECRET_KEY', render: 'RENDER_API_KEY' });
const gate = process.argv[2];
if (!Object.hasOwn(choices, gate)) {
  console.error('USAGE: node ops/cloud/credential-gate.cjs stripe|render');
  process.exit(2);
}
const configured = typeof process.env[choices[gate]] === 'string' && process.env[choices[gate]].length > 0;
const proof = {
  schema: 'BECK/CLOUD-CREDENTIAL-PRESENCE/v1',
  checked_at_utc: new Date().toISOString(),
  github_sha: process.env.GITHUB_SHA || null,
  github_run_id: process.env.GITHUB_RUN_ID || null,
  gate,
  status: configured ? 'CONFIGURED_NOT_AUTHENTICATED' : 'HOLD_MISSING_CREDENTIAL',
  source: 'GitHub Actions runner environment',
  checks_only_presence: true,
  provider_authenticated: false,
  settlement_verified: false,
  production_repaired: false,
  pc_required: false,
  note: 'Credential values are never copied to proof; configured does not imply valid access.'
};
const dir = path.resolve('proof/cloud');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, gate + '-credential-presence.json'), JSON.stringify(proof, null, 2) + '\n');
console.log('CLOUD_' + gate.toUpperCase() + '_GATE=' + proof.status);
if (!configured) process.exitCode = 1;
