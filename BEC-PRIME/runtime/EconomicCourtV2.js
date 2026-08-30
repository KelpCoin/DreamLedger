'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { validateSilo, validateCustomerRef } = require('../security/McpSecurity');

const ROOT = path.join(__dirname, '..');
const PROOF_DIR = path.join(ROOT, 'data', 'proofs');
const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;
const ZERO = 0;

function stable(value) { if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`; if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`; return JSON.stringify(value); }
function hash(value) { return crypto.createHash('sha256').update(stable(value), 'utf8').digest('hex'); }
function uuid(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function amountMinor(value) { const n = Number(value); if (!Number.isFinite(n) || n <= 0) throw new Error('Amount must be positive'); return Math.round(n * 100); }
function policyCheck(proposal) {
  const reasons = [];
  const silo = validateSilo(proposal.silo);
  if (proposal.action === 'checkout' && proposal.amount_minor <= ZERO) reasons.push('amount must be positive');
  if (proposal.action === 'checkout' && proposal.currency !== 'NZD') reasons.push('only NZD checkout proposals are permitted');
  if (proposal.action === 'checkout' && !proposal.customer_ref) reasons.push('opaque customer_ref required');
  if (proposal.customer_ref) validateCustomerRef(proposal.customer_ref);
  if (proposal.external_action === true) reasons.push('external action requires explicit human approval');
  return { eligible: reasons.length === 0, reasons, silo };
}
function propose(input) {
  const action = input.action === 'checkout' ? 'checkout' : 'offer';
  const proposal = { proposal_id: uuid(action === 'checkout' ? 'CHK' : 'OFF'), schema_version: 'ECONOMIC-COURT-2.0', state: 'PROPOSED', action, silo: validateSilo(input.silo), created_at: new Date().toISOString(), approval_required: true, autonomous_spend_limit_minor: ZERO, payload: input.payload || {} };
  if (action === 'checkout') { proposal.sku = String(input.payload?.sku || ''); proposal.amount_minor = amountMinor(input.payload?.amount); proposal.currency = String(input.payload?.currency || 'NZD').toUpperCase(); proposal.customer_ref = validateCustomerRef(input.payload?.customer_ref); }
  const check = policyCheck(proposal);
  proposal.court = check.eligible ? 'ELIGIBLE' : 'BLOCKED';
  proposal.state = check.eligible ? 'AWAITING_HUMAN_APPROVAL' : 'BLOCKED';
  proposal.block_reasons = check.reasons;
  return proposal;
}
function approvalPayload(proposal, approver, expiresAt, nonce) { return { approval_id: uuid('APP'), checkout_id: proposal.proposal_id, proposal_hash: hash({ proposal_id: proposal.proposal_id, sku: proposal.sku, amount_minor: proposal.amount_minor, currency: proposal.currency, silo: proposal.silo }), approved_by: approver || 'HUMAN', approved_at: new Date().toISOString(), expires_at: expiresAt, approval_nonce: nonce, allowed_sku: proposal.sku || null, allowed_amount_minor: proposal.amount_minor || null, allowed_currency: proposal.currency || null, allowed_silo: proposal.silo, version: 'APPROVAL-2.0', signature_algorithm: 'Ed25519' }; }
function signApproval(payload) {
  const privateKey = process.env.BECKPRIME_APPROVAL_PRIVATE_KEY_PEM;
  if (!privateKey) throw new Error('Approval signing key is not configured');
  return crypto.sign(null, Buffer.from(stable(payload), 'utf8'), privateKey).toString('base64url');
}
function approve(proposal, approver = 'HUMAN') {
  if (proposal.state !== 'AWAITING_HUMAN_APPROVAL') throw new Error(`Proposal is not awaiting approval: ${proposal.state}`);
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS).toISOString();
  const payload = approvalPayload(proposal, approver, expiresAt, crypto.randomBytes(32).toString('base64url'));
  const token = { ...payload, signature: signApproval(payload) };
  const approved = { ...proposal, state: 'HUMAN_APPROVED', approval_token: token };
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  fs.writeFileSync(path.join(PROOF_DIR, `${proposal.proposal_id}-APPROVAL.json`), JSON.stringify(approved, null, 2) + '\n', 'utf8');
  return approved;
}
function verifyApproval(proposal, token) {
  if (!token || token.checkout_id !== proposal.proposal_id) return { valid: false, reason: 'approval token does not match proposal' };
  if (Date.parse(token.expires_at) <= Date.now()) return { valid: false, reason: 'approval token expired' };
  if (proposal.sku && token.allowed_sku !== proposal.sku) return { valid: false, reason: 'SKU mismatch' };
  if (proposal.amount_minor && Number(token.allowed_amount_minor) !== Number(proposal.amount_minor)) return { valid: false, reason: 'amount mismatch' };
  if (proposal.currency && token.allowed_currency !== proposal.currency) return { valid: false, reason: 'currency mismatch' };
  if (token.allowed_silo !== proposal.silo) return { valid: false, reason: 'silo mismatch' };
  const publicKey = process.env.BECKPRIME_APPROVAL_PUBLIC_KEY_PEM;
  if (!publicKey) return { valid: false, reason: 'approval verification key is not configured' };
  const { signature, ...unsigned } = token;
  let valid = false;
  try { valid = crypto.verify(null, Buffer.from(stable(unsigned), 'utf8'), publicKey, Buffer.from(signature, 'base64url')); } catch { valid = false; }
  return valid ? { valid: true } : { valid: false, reason: 'signature invalid' };
}
function executable(proposal, token) { const verification = verifyApproval(proposal, token); if (!verification.valid) return { executable: false, state: 'BLOCKED', reason: verification.reason }; return { executable: true, state: 'EXECUTABLE', approval_id: token.approval_id }; }
module.exports = { propose, approve, verifyApproval, executable, amountMinor, hash };
