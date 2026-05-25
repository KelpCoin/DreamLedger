const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static(__dirname));

app.get('/api/carousel-data', (req, res) => {
    res.json({
        silos: [
            { id:'mtg', title:'MTG / Commander', tickerItems:['New deck uploaded','Price matrix updated','5 cards added to vault'], ctaText:'Browse MTG', ctaLink:'/mtg', bgClass:'bg-mtg', products:[{name:'Commander Deck Primer',price:'$4.99',stripe:''},{name:'Price Signal Pack',price:'$2.99',stripe:''}], trending:[{name:'Undervalued Picks',price:'$3.99',stripe:''}] },
            { id:'avatar', title:'Avatar Forge', tickerItems:['14 avatars forged','New species unlocked','Creator pack released'], ctaText:'Build Avatar', ctaLink:'/avatar', bgClass:'bg-avatar', products:[{name:'Custom Avatar Slot',price:'$9.99',stripe:''},{name:'Species Pack',price:'$4.99',stripe:''}], trending:[{name:'Legendary Skin',price:'$19.99',stripe:''}] },
            { id:'dreamledger', title:'DreamLedger', tickerItems:['Memory shard added','World fragment uploaded','Vault synchronized'], ctaText:'Enter Ledger', ctaLink:'/ledger', bgClass:'bg-dreamledger', products:[{name:'Memory Vault',price:'$1.99',stripe:''},{name:'Fragment Analyzer',price:'$5.99',stripe:''}], trending:[{name:'Archive Access',price:'$7.99',stripe:''}] },
            { id:'gameworld', title:'Game World', tickerItems:['Region preview released','Creature archive expanded','Alpha invite wave 2 sent'], ctaText:'Explore World', ctaLink:'/game', bgClass:'bg-gameworld', products:[{name:'Alpha Key',price:'$29.99',stripe:''},{name:'Lore Book',price:'$14.99',stripe:''}], trending:[{name:'Map Fragment',price:'$9.99',stripe:''}] }
        ]
    });
});

app.post('/api/avatar/create', (req, res) => {
    const av = req.body;
    const avatarDir = path.join(__dirname, 'avatars');
    if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
    fs.writeFileSync(path.join(avatarDir, av.id + '.json'), JSON.stringify(av, null, 2));
    res.json({ ok: true, avatarId: av.id });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('DreamLedger carousel on ' + PORT));
