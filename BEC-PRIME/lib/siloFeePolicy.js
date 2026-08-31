'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const POLICY_PATH = path.join(ROOT, 'docs', 'BECK-SILO-FEE-POLICY.json');
const POLICY = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
function normalize(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function resolve(silo) {
  const key = normalize(silo);
  const rules = POLICY.rules || {};
  const rule = rules[key] || rules.default;
  if (!rule) throw new Error('Silo fee policy has no default rule');
  return { silo: rule.silo, platform_fee_bps: Number(rule.platform_fee_bps), label: rule.label };
}
function assert(silo, declaredBps) {
  const rule = resolve(silo);
  if (declaredBps !== undefined && declaredBps !== null && Number(declaredBps) !== rule.platform_fee_bps) throw new Error('SILO_FEE_POLICY_VIOLATION: declared fee does not match server policy');
  return rule;
}
function sha256() { return crypto.createHash('sha256').update(fs.readFileSync(POLICY_PATH)).digest('hex'); }
module.exports = { resolve, assert, policySha256: sha256, policyPath: POLICY_PATH };
