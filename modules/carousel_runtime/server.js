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
        res.json([]);
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('DreamLedger carousel on ' + PORT));


// DREAMLEDGER_AVATAR_GAME_ROUTE_V1
app.post('/api/avatar/create', (req, res) => {
    const av = req.body;
    const avatarPath = path.join(__dirname, 'avatars', av.id + '.json');
    fs.writeFileSync(avatarPath, JSON.stringify(av, null, 2));
    res.json({ ok: true, avatarId: av.id });
});
app.post('/api/game/export-character', (req, res) => {
    const char = req.body;
    const gamePath = path.join(__dirname, 'game', char.avatarId + '.json');
    fs.writeFileSync(gamePath, JSON.stringify(char, null, 2));
    res.json({ ok: true, characterId: char.avatarId });
});
