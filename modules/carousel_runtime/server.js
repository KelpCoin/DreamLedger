const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static(__dirname));

app.get('/catalog', (req, res) => {
    const catalogPath = path.join(__dirname, '..', 'store', 'catalog.json');
    if (fs.existsSync(catalogPath)) {
        res.json(JSON.parse(fs.readFileSync(catalogPath, 'utf8')));
    } else {
        res.json([
            {"id":"fortune-cookie-001","title":"Fortune Cookie","price":1.49,"description":"A cryptic fortune. Instant.","stripe":"https://buy.stripe.com/REPLACE_ME"},
            {"id":"mystery-thought","title":"Mystery Thought Fragment","price":1.99,"description":"One profound, slightly cryptic statement.","stripe":"https://buy.stripe.com/REPLACE_ME"},
            {"id":"ai-haiku","title":"AI Haiku","price":0.99,"description":"A haiku about a random everyday object.","stripe":"https://buy.stripe.com/REPLACE_ME"}
        ]);
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/api/avatar/create', (req, res) => {
    const av = req.body;
    const avatarDir = path.join(__dirname, 'avatars');
    if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
    fs.writeFileSync(path.join(avatarDir, av.id + '.json'), JSON.stringify(av, null, 2));
    res.json({ ok: true, avatarId: av.id });
});

app.post('/api/game/export-character', (req, res) => {
    const char = req.body;
    const gameDir = path.join(__dirname, 'game');
    if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });
    fs.writeFileSync(path.join(gameDir, char.avatarId + '.json'), JSON.stringify(char, null, 2));
    res.json({ ok: true, characterId: char.avatarId });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('DreamLedger carousel on ' + PORT));

app.get('/beautiful', (req, res) => res.sendFile('C:\\BrownEyeCortex\\modules\\carousel_runtime\\index.html'));

