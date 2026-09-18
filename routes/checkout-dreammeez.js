// routes/checkout-dreammeez.js
// Minimal Stripe Checkout route for the DreamMeez commercial data slice.
// This route creates payment sessions only. Fulfillment must be handled by
// the canonical webhook path before public traffic is sent here.

const express = require('express');
const Stripe = require('stripe');
const router = express.Router();
const { dreamMeezProducts } = require('../dreammeez-products');

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function getBaseUrl() {
  return String(process.env.BASE_URL || process.env.SITE_URL || '').replace(/\/$/, '');
}

router.post('/checkout/dreammeez', async (req, res) => {
  const sku = String(req.body?.sku || '');
  const src = String(req.body?.src || 'direct').slice(0, 200);
  const product = dreamMeezProducts.find((item) => item.sku === sku);

  if (!product) {
    return res.status(400).json({ error: `Unknown SKU: ${sku}` });
  }

  const stripe = getStripe();
  const baseUrl = getBaseUrl();
  if (!stripe || !baseUrl) {
    return res.status(503).json({ error: 'checkout_not_configured' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: product.currency,
            product_data: { name: product.name },
            unit_amount: product.price_nzd
          },
          quantity: 1
        }
      ],
      payment_intent_data: {
        metadata: {
          product_sku: product.sku,
          silo: product.silo,
          source: src
        }
      },
      metadata: {
        product_sku: product.sku,
        silo: product.silo,
        source: src
      },
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel`
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('DreamMeez checkout session creation failed:', err);
    return res.status(500).json({ error: 'checkout_creation_failed' });
  }
});

module.exports = router;
