'use strict';

const path = require('path');
const { StripePaymentAdapter } = require('./StripePaymentAdapter');
const { BECKTransactionKernel } = require('./BECKTransactionKernel');

function createBECKWebhookHandler(options = {}) {
  const rootDir = path.resolve(options.rootDir || process.env.BECK_DATA_DIR || path.join(__dirname, '..', 'data', 'beck'));
  const adapter = new StripePaymentAdapter(options.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET);
  return {
    handle(rawBody, signatureHeader) {
      const payment = adapter.parseAndVerify(rawBody, signatureHeader);
      if (payment.event_type !== 'checkout.session.completed') return { received:true, handled:false, event_id:payment.stripe_event_id };
      if (payment.payment_status !== 'paid') return { received:true, handled:false, event_id:payment.stripe_event_id, reason:'PAYMENT_NOT_PAID' };
      const expectedSku = options.expectedSku || process.env.BECK_EXPECTED_SKU;
      if (expectedSku && String(payment.metadata.product_id || payment.metadata.sku || '') !== String(expectedSku)) throw Object.assign(new Error('BECK_SKU_MISMATCH'), { statusCode:400 });
      const kernel = new BECKTransactionKernel({ rootDir });
      try { return kernel.ingestStripeEvent(payment.event); } finally { kernel.close(); }
    }
  };
}

module.exports = { createBECKWebhookHandler };
