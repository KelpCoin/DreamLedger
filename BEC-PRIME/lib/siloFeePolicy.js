'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const POLICY_PATH = path.join(ROOT, 'config', 'commercial-rules.json');
const POLICY = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));

function normalize(value) {
  return String(value || 'unknown').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}

function normalizeChannel(channel) {
  const raw = String(channel || 'human_to_human').trim().toLowerCase().replace(/[-\s]+/g, '_');
  if (['h2h', 'human', 'human_to_human', 'peer_to_peer'].includes(raw)) return 'human_to_human';
  if (['a2a', 'x402', 'machine', 'machine_to_machine'].includes(raw)) return 'machine_to_machine';
  throw new Error('UNKNOWN_TRANSACTION_CHANNEL');
}

function resolve(silo, channel = 'human_to_human') {
  const channelKey = normalizeChannel(channel);
  const rule = POLICY.transaction_channels && POLICY.transaction_channels[channelKey];
  if (!rule || !Number.isFinite(Number(rule.platform_fee_bps))) {
    throw new Error('COMMERCIAL_POLICY_MISSING_CHANNEL_RULE');
  }
  return {
    silo: normalize(silo),
    channel: channelKey,
    platform_fee_bps: Number(rule.platform_fee_bps),
    label: String(rule.label || ''),
    status: String(rule.status || 'UNSPECIFIED')
  };
}

function assert(silo, declaredBps, channel = 'human_to_human') {
  const rule = resolve(silo, channel);
  if (declaredBps !== undefined && declaredBps !== null && Number(declaredBps) !== rule.platform_fee_bps) {
    throw new Error('SILO_FEE_POLICY_VIOLATION: declared fee does not match server policy');
  }
  return rule;
}

function canChargeA2A({ featureEnabled, paymentVerified, settlementVerified } = {}) {
  return featureEnabled === true && paymentVerified === true && settlementVerified === true;
}

function canPromote({ tenantPlan, featureEnabled, paymentVerified, fulfillmentVerified } = {}) {
  return featureEnabled === true
    && tenantPlan?.featured_listings === true
    && paymentVerified === true
    && fulfillmentVerified === true;
}

function isPromoted(serverProduct) {
  return Boolean(serverProduct && serverProduct.is_promoted === true);
}

function sha256() {
  return crypto.createHash('sha256').update(fs.readFileSync(POLICY_PATH)).digest('hex');
}

module.exports = {
  resolve,
  assert,
  canChargeA2A,
  canPromote,
  isPromoted,
  policySha256: sha256,
  policyPath: POLICY_PATH
};
