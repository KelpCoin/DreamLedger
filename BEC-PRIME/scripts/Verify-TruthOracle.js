'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const registryPath = path.join(root, 'public', 'truth-oracle.json');
const htmlPath = path.join(root, 'compiled', 'website', 'truth-oracle.html');
const outDir = path.join(root, 'proof');
fs.mkdirSync(outDir, { recursive: true });
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const failures = [];
if (registry.schema_version !== 'truth-oracle-v1') failures.push('schema_version');
if (registry.jurisdiction !== 'NZ') failures.push('jurisdiction');
if (!Array.isArray(registry.events)) failures.push('events');
for (const e of registry.events || []) {
  for (const key of ['event_id','event_date','country','event_type','verification_status','description','primary_source']) if (!e[key]) failures.push(`${e.event_id || 'unknown'}:${key}`);
  if (e.country !== 'NZ') failures.push(`${e.event_id}:country`);
  if (!/^https:\/\//.test(String(e.primary_source || ''))) failures.push(`${e.event_id}:primary_source`);
  if (e.verification_status === 'dreamledger_verified' && !e.dreamledger_artifact) failures.push(`${e.event_id}:dreamledger_artifact`);
}
if (!fs.existsSync(htmlPath)) failures.push('public_html_missing');
const canonical = JSON.stringify(registry);
const proof = {
  proof_version: 'truth-oracle-proof-v1',
  checked_at: new Date().toISOString(),
  registry_sha256: crypto.createHash('sha256').update(canonical, 'utf8').digest('hex'),
  event_count: (registry.events || []).length,
  statuses: (registry.events || []).reduce((a,e)=>{a[e.verification_status]=(a[e.verification_status]||0)+1;return a;},{}),
  public_html_present: fs.existsSync(htmlPath),
  verdict: failures.length ? 'FAIL' : 'PASS',
  failures
};
fs.writeFileSync(path.join(outDir, 'TRUTH-ORACLE-PROOF.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof, null, 2));
if (failures.length) process.exit(1);
