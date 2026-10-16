'use strict';

const crypto = require('node:crypto');

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalize(value[key])).join(',') + '}';
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function digestJson(value) {
  return sha256(Buffer.from(canonicalize(value), 'utf8'));
}

function signingPayload(receipt) {
  const copy = JSON.parse(JSON.stringify(receipt));
  if (copy.seller) delete copy.seller.signature;
  return Buffer.from(canonicalize(copy), 'utf8');
}

async function verifyDeliveryReceipt(receipt, options = {}) {
  const errors = [];
  const add = (code) => errors.push(code);
  const requirements = options.expectedRequirements;
  const request = options.expectedRequest;
  const body = options.responseBody;

  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return { verified: false, errors: ['receipt_not_object'] };
  }
  if (receipt.schema !== 'dreamledger/delivery-receipt/v1') add('schema_mismatch');
  if (!requirements || typeof requirements !== 'object') add('trusted_payment_requirements_missing');
  if (!request || typeof request !== 'object') add('trusted_request_context_missing');
  if (body === undefined || body === null) add('response_body_missing');
  if (typeof options.expectedSellerPublicKey !== 'string' || !options.expectedSellerPublicKey.trim()) add('trusted_seller_key_missing');
  if (typeof options.verifySettlement !== 'function') add('independent_settlement_verifier_missing');
  if (typeof options.verifyAnchor !== 'function') add('independent_anchor_verifier_missing');
  if (errors.length) return { verified: false, errors };

  const paymentRequirements = receipt.payment_requirements;
  if (!paymentRequirements || digestJson(paymentRequirements) !== receipt.payment_requirements_sha256) add('payment_requirements_hash_mismatch');
  if (digestJson(requirements) !== receipt.payment_requirements_sha256) add('payment_requirements_do_not_match_trusted_quote');

  const payment = receipt.payment || {};
  const reqChain = String(requirements.chain_id ?? requirements.network ?? '');
  if (!reqChain || String(payment.chain_id ?? payment.network ?? '') !== reqChain) add('payment_chain_mismatch');
  if (String(payment.asset ?? '') !== String(requirements.asset ?? '')) add('payment_asset_mismatch');
  if (String(payment.amount ?? '') !== String(requirements.amount ?? '')) add('payment_amount_mismatch');
  if (String(payment.payee ?? '') !== String(requirements.payTo ?? requirements.pay_to ?? '')) add('payment_payee_mismatch');
  if (!payment.payer || !payment.payee) add('payment_parties_missing');
  if (payment.payer && payment.payee && String(payment.payer).toLowerCase() === String(payment.payee).toLowerCase()) add('payer_equals_payee');
  if (!payment.tx_hash) add('settlement_transaction_reference_missing');
  if (payment.settlement_status !== 'SETTLED') add('payment_not_settled');

  const requestProof = receipt.request || {};
  if (String(requestProof.method || '').toUpperCase() !== String(request.method || '').toUpperCase()) add('request_method_mismatch');
  if (requestProof.url_hash !== sha256(Buffer.from(String(request.url || ''), 'utf8'))) add('request_url_hash_mismatch');
  if (requestProof.params_hash !== digestJson(request.params ?? {})) add('request_params_hash_mismatch');
  if (!Number.isFinite(Date.parse(requestProof.ts || ''))) add('request_timestamp_invalid');

  const responseProof = receipt.response || {};
  const bodyHash = sha256(Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8'));
  if (Number(responseProof.status) < 200 || Number(responseProof.status) >= 300) add('response_status_not_success');
  if (responseProof.body_sha256 !== bodyHash) add('response_body_hash_mismatch');
  if (receipt.delivery?.response_sha256 !== bodyHash) add('delivery_response_binding_mismatch');
  if (receipt.delivery?.status !== 'delivered') add('delivery_not_complete');
  if (!responseProof.content_type) add('response_content_type_missing');
  if (!Number.isFinite(Date.parse(responseProof.ts || ''))) add('response_timestamp_invalid');
  if (!Number.isFinite(Number(responseProof.latency_ms)) || Number(responseProof.latency_ms) < 0) add('response_latency_invalid');

  const seller = receipt.seller || {};
  if (!seller.key_id || !seller.signature) add('seller_signature_missing');
  else {
    try {
      const signature = Buffer.from(String(seller.signature), 'base64');
      if (!crypto.verify(null, signingPayload(receipt), options.expectedSellerPublicKey, signature)) add('seller_signature_invalid');
    } catch {
      add('seller_signature_invalid');
    }
  }

  try {
    if (options.verifySettlement && !(await options.verifySettlement(payment, receipt))) add('independent_settlement_verification_failed');
  } catch {
    add('independent_settlement_verification_failed');
  }
  try {
    if (options.verifyAnchor && !(await options.verifyAnchor(receipt.anchor, receipt))) add('independent_anchor_verification_failed');
  } catch {
    add('independent_anchor_verification_failed');
  }
  if (!receipt.anchor || typeof receipt.anchor !== 'object') add('anchor_reference_missing');

  return {
    verified: errors.length === 0,
    errors,
    receipt_id: receipt.receipt_id || null,
    payment_requirements_sha256: receipt.payment_requirements_sha256 || null,
    response_body_sha256: bodyHash
  };
}

module.exports = { verifyDeliveryReceipt, canonicalize, sha256, digestJson, signingPayload };
