const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const USERS_FILE = path.join(__dirname, 'users.json');
const DECKS_FILE = path.join(__dirname, 'decks.json');

function readUsers() { try { return JSON.parse(fs.readFileSync(USERS_FILE,'utf8')); } catch(e) { return []; } }
function writeUsers(users) { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }
function readDecks() { try { return JSON.parse(fs.readFileSync(DECKS_FILE,'utf8')); } catch(e) { return []; } }
function writeDecks(decks) { fs.writeFileSync(DECKS_FILE, JSON.stringify(decks, null, 2)); }

app.post('/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  let users = readUsers();
  if (users.find(u => u.username === username)) return res.status(409).json({ error: 'User exists' });
  users.push({ username, password });
  writeUsers(users);
  res.json({ ok: true });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ ok: true, token: 'demo-token-' + username });
});

// ---- MTG Community Page ----
app.get('/mtg', (req, res) => res.sendFile(path.join(__dirname, 'mtg.html')));

// ---- Discord Deck Ingestion Endpoint (secure with a simple token) ----
app.post('/api/decks', (req, res) => {
  const { token, deck } = req.body;
  // Change this token to something only you/wife know
  if (token !== 'my-discord-secret') return res.status(403).json({ error: 'Invalid token' });
  if (!deck || !deck.name) return res.status(400).json({ error: 'Deck must have at least a name' });
  let decks = readDecks();
  deck.added = new Date().toISOString();
  decks.push(deck);
  writeDecks(decks);
  res.json({ ok: true, count: decks.length });
});

// ---- Get all decks (for future display) ----
app.get('/api/decks', (req, res) => {
  res.json(readDecks());
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('DreamLedger running on ' + PORT));
