const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// STRIPE SETUP
const stripeKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeKey ? require('stripe')(stripeKey) : null;
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';

app.use(express.json());
app.use(express.static(__dirname));

//  CAROUSEL DATA 
app.get('/api/carousel-data', (req, res) => {
    res.json({
        silos: [
            {
                id:'mtg', title:'MTG / Commander',
                tickerItems:['New deck uploaded','Price matrix updated','5 cards added to vault','3 slots left at discount'],
                ctaText:'Browse MTG', bgClass:'bg-mtg', icon:'',
                products:[
                    {name:'Commander Deck Primer',price:4.99,img:''},
                    {name:'Price Signal Pack',price:2.99,img:''},
                    {name:'Deck Tech Template',price:1.49,img:''}
                ],
                trending:[
                    {name:'Undervalued Picks',price:3.99,img:''},
                    {name:'Trade Calculator',price:0.99,img:''}
                ]
            },
            {
                id:'avatar', title:'Avatar Forge',
                tickerItems:['14 avatars forged','New species unlocked','Creator pack released','Legendary skin drop'],
                ctaText:'Build Avatar', bgClass:'bg-avatar', icon:'',
                products:[
                    {name:'Custom Avatar Slot',price:9.99,img:''},
                    {name:'Species Pack',price:4.99,img:''},
                    {name:'Animation Set',price:2.99,img:''}
                ],
                trending:[
                    {name:'Legendary Skin',price:19.99,img:''},
                    {name:'Emote Pack',price:1.99,img:''}
                ]
            },
            {
                id:'dreamledger', title:'DreamLedger',
                tickerItems:['Memory shard added','World fragment uploaded','Vault synchronized','Echo recorder active'],
                ctaText:'Enter Ledger', bgClass:'bg-dreamledger', icon:'',
                products:[
                    {name:'Memory Vault',price:1.99,img:''},
                    {name:'Fragment Analyzer',price:5.99,img:''},
                    {name:'Data Crystal',price:3.49,img:''}
                ],
                trending:[
                    {name:'Archive Access',price:7.99,img:''},
                    {name:'Echo Recorder',price:0.99,img:''}
                ]
            },
            {
                id:'gameworld', title:'Game World',
                tickerItems:['Region preview released','Creature archive expanded','Alpha invite wave 2 sent','Map fragment discovered'],
                ctaText:'Explore World', bgClass:'bg-gameworld', icon:'',
                products:[
                    {name:'Alpha Key',price:29.99,img:''},
                    {name:'Lore Book',price:14.99,img:''},
                    {name:'Creature Concept Art',price:4.99,img:''}
                ],
                trending:[
                    {name:'Map Fragment',price:9.99,img:''},
                    {name:'Soundtrack',price:6.99,img:''}
                ]
            }
        ]
    });
});

//  STRIPE CHECKOUT 
app.post('/api/create-checkout-session', async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY env var on Render.', fallback: true });
    }
    try {
        const { items } = req.body;
        const lineItems = items.map(item => ({
            quantity: item.quantity || 1,
            price_data: {
                currency: 'nzd',
                product_data: { name: item.name },
                unit_amount: Math.round(item.price * 100)
            }
        }));
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            success_url: BASE_URL + '/?success=true',
            cancel_url: BASE_URL + '/?canceled=true',
            line_items: lineItems
        });
        res.json({ url: session.url });
    } catch (e) {
        console.error('Stripe error:', e.message);
        res.status(500).json({ error: e.message, fallback: true });
    }
});

//  AVATAR CREATE (Bitmoji style) 
app.post('/api/avatar/create', (req, res) => {
    const av = req.body;
    const avatarDir = path.join(__dirname, 'avatars');
    if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
    av.id = av.id || ('av_' + Date.now());
    av.tier = av.tier || 'Seed';
    av.created = av.created || new Date().toISOString();
    fs.writeFileSync(path.join(avatarDir, av.id + '.json'), JSON.stringify(av, null, 2));
    res.json({ ok: true, avatarId: av.id, avatar: av });
});

//  GAME EXPORT 
app.post('/api/game/export-character', (req, res) => {
    const char = req.body;
    const gameDir = path.join(__dirname, 'game');
    if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });
    char.exportedAt = new Date().toISOString();
    fs.writeFileSync(path.join(gameDir, (char.avatarId || 'char_' + Date.now()) + '.json'), JSON.stringify(char, null, 2));
    res.json({ ok: true, characterId: char.avatarId });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('DreamLedger running on port ' + PORT + (stripe ? ' (Stripe LIVE)' : ' (Stripe NOT configured)')));


app.post('/api/invite', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const code = [...Array(8)].map(() => Math.random().toString(36)[2]).join('').toUpperCase();
  await supabase.from('invites').insert({ email, code });

  console.log(Invite code for : );
  res.json({ success: true, code });
});

app.get('/api/verify-invite', async (req, res) => {
  const { code } = req.query;
  const { data } = await supabase.from('invites').select('code').eq('code', code).single();
  res.json({ valid: !!data });
});

// ---- Invite System ----
app.post('/api/invite', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const code = [...Array(8)].map(() => Math.random().toString(36)[2]).join('').toUpperCase();
  await supabase.from('invites').insert({ email, code });

  console.log(Invite code for : );
  res.json({ success: true, code });
});

app.get('/api/verify-invite', async (req, res) => {
  const { code } = req.query;
  const { data } = await supabase.from('invites').select('code').eq('code', code).single();
  res.json({ valid: !!data });
});

