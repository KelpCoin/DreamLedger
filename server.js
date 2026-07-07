const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();

app.use(express.static('public'));
app.use(express.json());

let catalog = [];
try {
  catalog = require('./catalog.json');
} catch (e) {
  console.error('Catalog load failed', e);
}

app.get('/api/catalog', (req, res) => {
  res.json(catalog);
});

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { productId } = req.body;
    const product = catalog.find(p => p.id === productId);
    if (!product) return res.status(404).json({error: 'Product not found'});

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'nzd',
          product_data: { 
            name: product.title, 
            description: product.description,
            images: product.image ? [`https://dreamledger.org${product.image}`] : []
          },
          unit_amount: product.price,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.headers.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).json({error: 'Server error'});
  }
});

app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));

app.listen(process.env.PORT || 3000, () => {
  console.log('DreamLedger Stripe server running');
});