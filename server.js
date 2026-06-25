const express = require('express');
const app = express();
require('dotenv').config();
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'dreamledger', version: '2.1.0', ts: Date.now() });
});

// ===== MTG Silo Routes =====
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.get('/', (req, res) => res.render('index'));

app.get('/mtg', async (req, res) => {
  const { data: decks } = await supabase
    .from('decks')
    .select('id, name, commander, price_nzd, image_url, card_count')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  res.render('mtg', { decks });
});

app.get('/mtg/:id', async (req, res) => {
  const { data: deck } = await supabase
    .from('decks')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (!deck) return res.status(404).send('Deck not found');
  res.render('deck', { deck });
});

app.get('/api/decks', async (req, res) => {
  const { data } = await supabase.from('decks').select('*').eq('status', 'published');
  res.json(data);
});

app.post('/api/checkout', async (req, res) => {
  const { deckId } = req.body;
  const { data: deck } = await supabase
    .from('decks')
    .select('name, price_nzd')
    .eq('id', deckId)
    .single();
  if (!deck) return res.status(404).json({ error: 'Deck not found' });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'nzd',
        product_data: { name: deck.name },
        unit_amount: deck.price_nzd,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${req.headers.origin}/success?deck=${deckId}`,
    cancel_url: `${req.headers.origin}/mtg`,
    metadata: { deckId },
  });
  res.json({ sessionUrl: session.url });
});

// Success page (optional)
app.get('/success', (req, res) => {
  res.send(`<h1>Thank you!</h1><p>Your deck is being prepared. You'll receive a confirmation shortly.</p><a href="/mtg">Back to catalog</a>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`DreamLedger running on port ${PORT}`));