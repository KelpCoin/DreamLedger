const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const DATA_PATH = path.join(__dirname, '..', 'data', 'products.json');
const STREAK_PATH = path.join(__dirname, '..', 'data', 'streaks.json');
let cachedProducts = [];
let lastLoad = 0;

function loadProducts() {
  const now = Date.now();
  if (now - lastLoad < 10000) return cachedProducts;
  try {
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    cachedProducts = Array.isArray(data.products) ? data.products : [];
  } catch (_) {
    cachedProducts = [];
  }
  lastLoad = now;
  return cachedProducts;
}

router.get('/shop', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'compiled', 'website', 'shop.html'));
});

router.get('/api/catalog', (req, res) => {
  const products = loadProducts().filter(p => p && p.id && p.approved !== false);
  res.set('Cache-Control', 'public, max-age=10');
  res.json({ products, generated_at: new Date().toISOString() });
});

function readStreaks() {
  try { return JSON.parse(fs.readFileSync(STREAK_PATH, 'utf8')); } catch (_) { return {}; }
}
function writeStreaks(data) {
  fs.mkdirSync(path.dirname(STREAK_PATH), { recursive: true });
  fs.writeFileSync(STREAK_PATH, JSON.stringify(data, null, 2));
}
function visitorId(req) {
  return req.cookies && req.cookies.visitorId;
}

router.post('/api/streak/visit', (req, res) => {
  let id = visitorId(req);
  if (!id) {
    id = require('crypto').randomBytes(18).toString('hex');
    res.cookie('visitorId', id, { maxAge: 30 * 24 * 3600000, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  }
  const streaks = readStreaks();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const entry = streaks[id] || { lastDate: null, count: 0 };
  if (entry.lastDate !== today) {
    entry.count = entry.lastDate === yesterday ? entry.count + 1 : 1;
    entry.lastDate = today;
    streaks[id] = entry;
    writeStreaks(streaks);
  }
  res.json({ streak: entry.count, discountUnlocked: entry.count >= 3 });
});

router.get('/api/streak/status', (req, res) => {
  const id = visitorId(req);
  if (!id) return res.json({ streak: 0, discountUnlocked: false });
  const entry = readStreaks()[id];
  res.json({ streak: entry ? entry.count : 0, discountUnlocked: !!entry && entry.count >= 3 });
});

router.get('/api/locale', (req, res) => {
  const language = String(req.headers['accept-language'] || 'en').split(',')[0].split('-')[0].toLowerCase();
  res.json({ language, currency: 'NZD', region: 'NZ', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Pacific/Auckland' });
});

module.exports = router;
