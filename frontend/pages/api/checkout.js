import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const { offer_id } = req.body;
  if (!offer_id) return res.status(400).json({ error: 'Missing offer_id' });
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{ price_data: { currency: 'usd', product_data: { name: 'DreamLedger Offer' }, unit_amount: 2000 }, quantity: 1 }],
      metadata: { offer_id },
      success_url: 'https://dreamledger.org/success',
      cancel_url: 'https://dreamledger.org/cancel'
    });
    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
