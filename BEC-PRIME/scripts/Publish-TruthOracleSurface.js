'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'public', 'truth-oracle.json');
const DEST_DIR = path.join(ROOT, 'compiled', 'website');
const DEST = path.join(DEST_DIR, 'truth-oracle.json');
const ROLE_POLICY = path.join(ROOT, 'catalog', 'transparency', 'patreon-role-policy.json');
const PUBLIC_ROLE_POLICY = path.join(DEST_DIR, 'transparency-policy.json');

fs.mkdirSync(DEST_DIR, { recursive: true });
const registry = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
if (registry.schema_version !== 'truth-oracle-v1') throw new Error('TRUTH_ORACLE_PUBLISH_FAILED: invalid registry schema');
if (!Array.isArray(registry.events)) throw new Error('TRUTH_ORACLE_PUBLISH_FAILED: events must be an array');

const canonical = JSON.stringify(registry, null, 2) + '\n';
fs.writeFileSync(DEST, canonical, 'utf8');

if (fs.existsSync(ROLE_POLICY)) {
  const policy = JSON.parse(fs.readFileSync(ROLE_POLICY, 'utf8'));
  if (policy.schema !== 'DREAMLEDGER/PROGRESSIVE-TRANSPARENCY/v1') throw new Error('TRUTH_ORACLE_PUBLISH_FAILED: invalid transparency policy schema');
  const publicPolicy = {
    schema: policy.schema,
    public_rule: policy.public_rule,
    roles: policy.roles.map((r) => ({
      role_id: r.role_id,
      name: r.name,
      disclosure_class: r.disclosure_class,
      allowed_public_outputs: r.allowed_public_outputs,
      protected_information: r.protected_information
    }))
  };
  fs.writeFileSync(PUBLIC_ROLE_POLICY, JSON.stringify(publicPolicy, null, 2) + '\n', 'utf8');
}

const sha256 = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
const proofPath = path.join(ROOT, 'proof', 'TRUTH-ORACLE-SURFACE-PUBLISH-PROOF.json');
fs.mkdirSync(path.dirname(proofPath), { recursive: true });
fs.writeFileSync(proofPath, JSON.stringify({
  proof_version: 'truth-oracle-surface-publish-proof-v1',
  generated_at: new Date().toISOString(),
  source: 'public/truth-oracle.json',
  served_copy: 'compiled/website/truth-oracle.json',
  registry_sha256: sha256,
  registry_event_count: registry.events.length,
  transparency_policy_served: fs.existsSync(PUBLIC_ROLE_POLICY),
  verdict: 'PASS'
}, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({
  status: 'PASS',
  registry_sha256: sha256,
  registry_event_count: registry.events.length,
  served_registry: DEST,
  served_policy: fs.existsSync(PUBLIC_ROLE_POLICY) ? PUBLIC_ROLE_POLICY : null,
  proof: proofPath
}, null, 2));
