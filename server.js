const express = require('express');
const app = express();
const path = require('path');

// =========================================
// 1. EARLY DEBUG ROUTE (no dependencies)
// =========================================
app.get('/debug', (req, res) => {
  res.json({
    ok: true,
    file: 'server.js (robust)',
    routes: ['/health', '/debug', '/mtg', '/mtg/:id', '/api/decks', '/mtg-test'],
    ts: Date.now()
  });
});

app.get('/mtg-test', (req, res) => {
  res.send('MTG test route works.');
});

// =========================================
// 2. Health check (minimal)
// =========================================
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'dreamledger', version: '2.1.0', ts: Date.now() });
});

// =========================================
// 3. Load dependencies with error logging
// =========================================
let supabase, stripe;
try {
  require('dotenv').config();
  const { createClient } = require('@supabase/supabase-js');
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  console.log(' Supabase & Stripe initialized.');
} catch (err) {
  console.error(' Dependency init error:', err.message);
}

// =========================================
// 4. MTG Routes (with graceful fallback)
// =========================================
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/mtg', async (req, res) => {
  try {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data: decks } = await supabase
      .from('decks')
      .select('id, name, commander, price_nzd, image_url, card_count')
      .eq('status', 'published')
      .order('created_at', { ascending: false });
    res.render('mtg', { decks });
  } catch (err) {
    console.error('/mtg error:', err.message);
    res.status(500).send('Error loading decks  check logs.');
  }
});

app.get('/mtg/:id', async (req, res) => {
  try {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data: deck } = await supabase
      .from('decks')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (!deck) return res.status(404).send('Deck not found');
    res.render('deck', { deck });
  } catch (err) {
    console.error('/mtg/:id error:', err.message);
    res.status(500).send('Error loading deck  check logs.');
  }
});

app.get('/api/decks', async (req, res) => {
  try {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data } = await supabase.from('decks').select('*').eq('status', 'published');
    res.json(data);
  } catch (err) {
    console.error('/api/decks error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/checkout', async (req, res) => {
  try {
    if (!stripe) throw new Error('Stripe not initialized');
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
      success_url: ${req.headers.origin}/success?deck=,
      cancel_url: ${req.headers.origin}/mtg,
      metadata: { deckId },
    });
    res.json({ sessionUrl: session.url });
  } catch (err) {
    console.error('/api/checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/success', (req, res) => {
  res.send(<h1>Thank you!</h1><p>Your deck is being prepared.</p><a href="/mtg">Back</a>);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log( DreamLedger running on port ));