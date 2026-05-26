const fs = require('fs');
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const ROOT = __dirname;
const DATA = path.join(ROOT, 'runtime', 'data');

const usersPath = path.join(DATA, 'users.json');
const cardsPath = path.join(DATA, 'cards.json');
const sessionsPath = path.join(DATA, 'sessions.json');

// ensure data dir
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });

function loadJson(p, fallback) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch(e) { return fallback; }
}
function saveJson(p, data) {
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

// AUTH MIDDLEWARE
function auth(req, res, next) {
    const token = req.headers['x-session-token'];
    const sessions = loadJson(sessionsPath, {});
    const username = sessions[token];
    if (!username) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    req.username = username;
    next();
}

app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));

// HEALTH
app.get('/health', (req, res) => res.json({ ok: true, version: '3.0.0-no-stripe' }));

// REGISTER / LOGIN
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ ok: false, error: 'MISSING_FIELDS' });
    const users = loadJson(usersPath, []);
    if (users.find(u => u.username === username)) return res.json({ ok: false, error: 'USER_EXISTS' });
    const hash = bcrypt.hashSync(password, 10);
    users.push({ username, password: hash, created: new Date().toISOString() });
    saveJson(usersPath, users);
    res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = loadJson(usersPath, []);
    const user = users.find(u => u.username === username);
    if (!user) return res.json({ ok: false, error: 'NO_USER' });
    if (!bcrypt.compareSync(password, user.password)) return res.json({ ok: false, error: 'BAD_PASSWORD' });
    const token = uuidv4();
    const sessions = loadJson(sessionsPath, {});
    sessions[token] = username;
    saveJson(sessionsPath, sessions);
    res.json({ ok: true, token });
});

// CARDS
app.post('/api/cards', auth, (req, res) => {
    const { title, set, price, condition } = req.body;
    if (!title) return res.json({ ok: false, error: 'NO_TITLE' });
    const cards = loadJson(cardsPath, []);
    const newCard = {
        id: uuidv4(),
        seller: req.username,
        title,
        set,
        condition: condition || 'LP',
        price: Number(price),
        created: new Date().toISOString(),
        views: 0,
        clicks: 0
    };
    cards.push(newCard);
    saveJson(cardsPath, cards);
    res.json({ ok: true, card: newCard });
});

app.get('/api/cards', (req, res) => {
    const cards = loadJson(cardsPath, []);
    // Inject NZ Community CTA as a virtual card (always first)
    const communityCTA = {
        id: 'nz_mtg_community',
        type: 'cta',
        title: 'NZ MTG Community',
        set: 'Aotearoa  Independent',
        price: 0,
        condition: 'Join now',
        ctaUrl: 'https://discord.gg/YOUR_INVITE',  // <-- REPLACE with your real invite
        priority: -1
    };
    const allCards = [communityCTA, ...cards];
    // Sort by priority (lower first), then created date
    allCards.sort((a,b) => (a.priority || 0) - (b.priority || 0) || new Date(b.created) - new Date(a.created));
    res.json({ ok: true, cards: allCards });
});

// FEED ENDPOINT (infinite swipe)
app.get('/api/feed', (req, res) => {
    const cards = loadJson(cardsPath, []);
    const communityCTA = {
        id: 'nz_mtg_community',
        type: 'cta',
        title: 'NZ MTG Community',
        set: 'Aotearoa  Independent',
        price: 0,
        condition: 'Join now',
        ctaUrl: 'https://discord.gg/YOUR_INVITE',
        priority: -1
    };
    let feed = [communityCTA, ...cards];
    feed.sort((a,b) => (a.priority || 0) - (b.priority || 0) || new Date(b.created) - new Date(a.created));
    const cursor = parseInt(req.query.cursor || 0);
    const limit = parseInt(req.query.limit || 10);
    const slice = feed.slice(cursor, cursor + limit);
    res.json({
        cards: slice,
        nextCursor: cursor + slice.length,
        hasMore: cursor + slice.length < feed.length
    });
});

// VIEW / CLICK tracking (optional)
app.post('/api/view', (req, res) => {
    const { id } = req.body;
    const cards = loadJson(cardsPath, []);
    const card = cards.find(c => c.id === id);
    if (card && card.type !== 'cta') card.views = (card.views || 0) + 1;
    if (card) saveJson(cardsPath, cards);
    res.json({ ok: true });
});
app.post('/api/click', (req, res) => {
    const { id } = req.body;
    const cards = loadJson(cardsPath, []);
    const card = cards.find(c => c.id === id);
    if (card && card.type !== 'cta') card.clicks = (card.clicks || 0) + 1;
    if (card) saveJson(cardsPath, cards);
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Cortex Carousel running on port ${PORT}`));
