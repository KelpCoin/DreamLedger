const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// STRIPE SETUP  uses your local environment
const stripeKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeKey ? require('stripe')(stripeKey) : null;
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';

app.use(express.json());
app.use(express.static(__dirname));

//  CAROUSEL DATA 
app.get('/api/carousel-data', (req, res) => {
    res.json({
        silos: [
            { id:'mtg', title:'MTG / Commander', tickerItems:['New deck uploaded','Price matrix updated','5 cards added to vault'],
              ctaText:'Browse MTG', ctaLink:'/mtg', bgClass:'bg-mtg',
              products:[
                {name:'Commander Deck Primer',price:4.99,stripePriceId:'',img:''},
                {name:'Price Signal Pack',price:2.99,stripePriceId:'',img:''},
                {name:'Deck Tech Template',price:1.49,stripePriceId:'',img:''}
              ],
              trending:[
                {name:'Undervalued Picks',price:3.99,stripePriceId:'',img:''},
                {name:'Trade Calculator',price:0.99,stripePriceId:'',img:''}
              ]
            },
            { id:'avatar', title:'Avatar Forge', tickerItems:['14 avatars forged','New species unlocked','Creator pack released'],
              ctaText:'Build Avatar', ctaLink:'/avatar', bgClass:'bg-avatar',
              products:[
                {name:'Custom Avatar Slot',price:9.99,stripePriceId:'',img:''},
                {name:'Species Pack',price:4.99,stripePriceId:'',img:''},
                {name:'Animation Set',price:2.99,stripePriceId:'',img:''}
              ],
              trending:[
                {name:'Legendary Skin',price:19.99,stripePriceId:'',img:''},
                {name:'Emote Pack',price:1.99,stripePriceId:'',img:''}
              ]
            },
            { id:'dreamledger', title:'DreamLedger', tickerItems:['Memory shard added','World fragment uploaded','Vault synchronized'],
              ctaText:'Enter Ledger', ctaLink:'/ledger', bgClass:'bg-dreamledger',
              products:[
                {name:'Memory Vault',price:1.99,stripePriceId:'',img:''},
                {name:'Fragment Analyzer',price:5.99,stripePriceId:'',img:''},
                {name:'Data Crystal',price:3.49,stripePriceId:'',img:''}
              ],
              trending:[
                {name:'Archive Access',price:7.99,stripePriceId:'',img:''},
                {name:'Echo Recorder',price:0.99,stripePriceId:'',img:''}
              ]
            },
            { id:'gameworld', title:'Game World', tickerItems:['Region preview released','Creature archive expanded','Alpha invite wave 2 sent'],
              ctaText:'Explore World', ctaLink:'/game', bgClass:'bg-gameworld',
              products:[
                {name:'Alpha Key',price:29.99,stripePriceId:'',img:''},
                {name:'Lore Book',price:14.99,stripePriceId:'',img:''},
                {name:'Creature Concept Art',price:4.99,stripePriceId:'',img:''}
              ],
              trending:[
                {name:'Map Fragment',price:9.99,stripePriceId:'',img:''},
                {name:'Soundtrack',price:6.99,stripePriceId:'',img:''}
              ]
            }
        ]
    });
});

//  STRIPE CHECKOUT 
app.post('/api/create-checkout-session', async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY environment variable.' });
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
        // FALLBACK: return a Gumroad-style direct link or prompt
        res.status(500).json({ error: e.message, fallback: true });
    }
});

//  AVATAR CREATE 
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

//  SERVE LANDING PAGE 
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('DreamLedger running on port ' + PORT + (stripe ? ' (Stripe LIVE)' : ' (Stripe NOT configured)')));
