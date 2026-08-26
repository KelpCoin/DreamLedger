'use strict';

const stripeProof = require('../lib/stripeWebhookProof');

class StripePaymentAdapter {
  constructor(webhookSecret) { this.webhookSecret = String(webhookSecret || ''); }

  parseAndVerify(rawBody, signatureHeader) {
    stripeProof.verifyStripeSignature(rawBody, signatureHeader, this.webhookSecret);
    let event;
    try { event = JSON.parse(rawBody); } catch { throw Object.assign(new Error('INVALID_STRIPE_JSON'), { statusCode:400 }); }
    if (!event.id || !event.type || !event.data?.object) throw Object.assign(new Error('INVALID_STRIPE_EVENT'), { statusCode:400 });
    const session = event.data.object;
    return {
      stripe_event_id: String(event.id),
      event_type: String(event.type),
      payment_intent_id: session.payment_intent ? String(session.payment_intent) : null,
      transaction_id: session.id ? String(session.id) : String(event.id),
      amount_minor: Number(session.amount_total || 0),
      currency: String(session.currency || '').toUpperCase(),
      metadata: session.metadata || {},
      payment_status: String(session.payment_status || ''),
      event
    };
  }
}

module.exports = { StripePaymentAdapter };
