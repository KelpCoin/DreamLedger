'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  verifyDeliveryReceipt,
  sha256,
  digestJson,
  signingPayload
} = require('./DeliveryReceiptVerifier');

function fixture() {
  const keys = crypto.generateKeyPairSync('ed25519');
  const requirements = {
    scheme: 'x402',
    chain_id: '8453',
    payTo: '0xSeller',
    amount: '2900',
    asset: 'USDC',
    resource: 'https://dreamledger.org/receipt-test-resource',
    timeout: 30
  };
  const request = {
    method: 'POST',
    url: requirements.resource,
    params: { sku: 'CMD-DIAG-29', test_only: true }
  };
  const body = Buffer.from('test-only delivered response', 'utf8');
  const now = new Date().toISOString();
  const receipt = {
    schema: 'dreamledger/delivery-receipt/v1',
    receipt_id: 'TEST-RECEIPT-001',
    payment_requirements: requirements,
    payment_requirements_sha256: digestJson(requirements),
    payment: {
      chain_id: '8453',
      tx_hash: '0x' + 'a'.repeat(64),
      asset: 'USDC',
      amount: '2900',
      payer: '0xBuyer',
      payee: '0xSeller',
      settlement_status: 'SETTLED'
    },
    request: {
      method: 'POST',
      url_hash: sha256(Buffer.from(request.url, 'utf8')),
      params_hash: digestJson(request.params),
      ts: now
    },
    response: {
      status: 200,
      body_sha256: sha256(body),
      content_type: 'application/json',
      ts: now,
      latency_ms: 12
    },
    delivery: {
      status: 'delivered',
      response_sha256: sha256(body)
    },
    seller: { key_id: 'test-seller-key', signature: '' },
    anchor: { chain_id: '8453', attestation_uid: 'test-anchor-uid', merkle_root: 'test-root' }
  };
  function sign() {
    receipt.seller.signature = crypto.sign(null, signingPayload(receipt), keys.privateKey).toString('base64');
    return receipt;
  }
  const options = {
    expectedSellerPublicKey: keys.publicKey,
    // Keep the trusted quote independent from the mutable receipt object.\n    // Sharing this reference would let a re-signed receipt rewrite its own authority.\n    expectedRequirements: JSON.parse(JSON.stringify(requirements)),
    expectedRequest: request,
    responseBody: body,
    verifySettlement: async payment => payment.settlement_status === 'SETTLED' && Boolean(payment.tx_hash),
    verifyAnchor: async anchor => anchor?.attestation_uid === 'test-anchor-uid' && Boolean(anchor?.merkle_root)
  };
  return { receipt, options, body, sign };
}

test('accepts a signed receipt only when request, response, quote, settlement and anchor bind', async () => {
  const f = fixture();
  f.sign();
  const result = await verifyDeliveryReceipt(f.receipt, f.options);
  assert.equal(result.verified, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.receipt_id, 'TEST-RECEIPT-001');
});

test('rejects payer equal to payee even with a valid seller signature', async () => {
  const f = fixture();
  f.receipt.payment.payer = '0xSeller';
  f.sign();
  const result = await verifyDeliveryReceipt(f.receipt, f.options);
  assert.equal(result.verified, false);
  assert.ok(result.errors.includes('payer_equals_payee'));
});

test('rejects changed delivery bytes', async () => {
  const f = fixture();
  f.sign();
  f.options.responseBody = Buffer.from('different response', 'utf8');
  const result = await verifyDeliveryReceipt(f.receipt, f.options);
  assert.equal(result.verified, false);
  assert.ok(result.errors.includes('response_body_hash_mismatch'));
  assert.ok(result.errors.includes('delivery_response_binding_mismatch'));
});

test('rejects payment requirement drift even if receipt is re-signed', async () => {
  const f = fixture();
  f.receipt.payment_requirements.amount = '1';
  f.receipt.payment_requirements_sha256 = digestJson(f.receipt.payment_requirements);
  f.sign();
  const result = await verifyDeliveryReceipt(f.receipt, f.options);
  assert.equal(result.verified, false);
  assert.ok(result.errors.includes('payment_requirements_do_not_match_trusted_quote'));
});

test('rejects partial delivery and unverified settlement', async () => {
  const f = fixture();
  f.receipt.delivery.status = 'partial';
  f.receipt.payment.settlement_status = 'UNSETTLED';
  f.sign();
  f.options.verifySettlement = async () => false;
  const result = await verifyDeliveryReceipt(f.receipt, f.options);
  assert.equal(result.verified, false);
  assert.ok(result.errors.includes('delivery_not_complete'));
  assert.ok(result.errors.includes('payment_not_settled'));
  assert.ok(result.errors.includes('independent_settlement_verification_failed'));
});

test('fails closed when independent settlement or anchor verifiers are absent', async () => {
  const f = fixture();
  f.sign();
  delete f.options.verifySettlement;
  delete f.options.verifyAnchor;
  const result = await verifyDeliveryReceipt(f.receipt, f.options);
  assert.equal(result.verified, false);
  assert.ok(result.errors.includes('independent_settlement_verifier_missing'));
  assert.ok(result.errors.includes('independent_anchor_verifier_missing'));
});
