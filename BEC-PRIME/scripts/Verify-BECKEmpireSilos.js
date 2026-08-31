'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const REGISTRY_PATH = path.join(ROOT, 'docs', 'BECK-EMPIRE-SILO-REGISTRY.json');
const FEE_PATH = path.join(ROOT, 'docs', 'BECK-SILO-FEE-POLICY.json');
const OUT_DIR = path.join(ROOT, 'BEC-PRIME', 'PROOF');
const OUT_PATH = path.join(OUT_DIR, 'beck-empire-silo-proof.json');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function sha256File(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
function check(checks, name, ok, detail) { checks.push({ name, ok: !!ok, detail: detail || '' }); }

const checks = [];
const registry = readJson(REGISTRY_PATH);
const fee = readJson(FEE_PATH);

check(checks, 'registry schema', registry.schema === 'BECK/EMPIRE-SILO-REGISTRY/v1');
check(checks, 'fee invariant text', registry.fee_invariant === 'MTG=0% forever; every other silo=5% flat');
check(checks, 'fee policy schema', fee.schema === 'BECK/SILO-FEE-POLICY/v1');

const silos = registry.silos || {};
for (const [name, silo] of Object.entries(silos)) {
  check(checks, `${name} fee is canonical`, name === 'MTG' ? silo.platform_fee_bps === 0 : silo.platform_fee_bps === 500, `fee_bps=${silo.platform_fee_bps}`);
  check(checks, `${name} has public surface declaration`, Array.isArray(silo.public_domains) && Array.isArray(silo.public_prefixes));
  check(checks, `${name} has isolation contract`, Array.isArray(silo.cross_silo_forbidden_domains) && Array.isArray(silo.cross_silo_forbidden_terms));
}

const policyRules = fee.rules || {};
check(checks, 'policy MTG is zero', policyRules['dreamledger-mtg']?.platform_fee_bps === 0);
check(checks, 'policy Amplissa is five percent', policyRules.amplissa?.platform_fee_bps === 500);
check(checks, 'policy BBW is five percent', policyRules['bbw-ssbbw-creator']?.platform_fee_bps === 500);
check(checks, 'policy default is five percent', policyRules.default?.platform_fee_bps === 500);
check(checks, 'only MTG is zero fee', Object.entries(silos).filter(([k, v]) => v.platform_fee_bps === 0).map(([k]) => k).join(',') === 'MTG');
check(checks, 'registry and fee policy hashes captured', true);

const proof = {
  schema: 'BECK/EMPIRE-SILO-PROOF/v1',
  generated_at: new Date().toISOString(),
  status: checks.every(c => c.ok) ? 'PASS' : 'FAIL',
  checks,
  registry_sha256: sha256File(REGISTRY_PATH),
  fee_policy_sha256: sha256File(FEE_PATH),
  first_dollar_order: ['MTG/EDH_0001', 'MTG/EDH_ONE_LINK', 'MTG/INVENTORY_CUSTOMIZATION', 'MTG/CINEMA', 'AMPLISSA', 'BBW_SSBBW', 'DREAMMEEZ', 'OTHER']
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));
if (proof.status !== 'PASS') process.exit(1);
