const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// User accounts (same file-based)
const USERS_FILE = path.join(__dirname, 'users.json');
function readUsers() { try { return JSON.parse(fs.readFileSync(USERS_FILE,'utf8')); } catch(e) { return []; } }
function writeUsers(users) { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }

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
app.get('/mtg', (req, res) => {
  res.sendFile(path.join(__dirname, 'mtg.html'));
});

// ---- Health check ----
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ---- Root serves the carousel landing page ----
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('DreamLedger running on ' + PORT));
