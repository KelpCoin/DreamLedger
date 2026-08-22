'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const originalCreateServer = http.createServer;
const PUBLIC_ROOT = path.join(__dirname, '..', 'compiled', 'website');
const INDEX_FILE = path.join(PUBLIC_ROOT, 'index.html');
const MTG_FILE = path.join(PUBLIC_ROOT, 'mtg', 'index.html');
const BESPOKE_MTG_FILE = path.join(__dirname, '..', 'surface', 'mtg-bespoke-offer.html');
const BOARD_FILE = path.join(PUBLIC_ROOT, 'board.html');
const BESPOKE_LINK = 'https://buy.stripe.com/fZuaEX3vn15r4Q74kAdwc1S';

function send(res, status, body) {
  if (res.writableEnded) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

async function inventory(res) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!base || !key) return send(res, 503, { error: 'Supabase configuration missing' });
  try {
    const url = base + '/rest/v1/molt_beach_campaigns?status=eq.PUBLISHED&select=campaign_id,x,y,width,height,price_nzd,image_url,destination_url,published_at&order=y.asc,x.asc';
    const r = await fetch(url, { headers: { apikey: key, authorization: 'Bearer ' + key } });
    if (!r.ok) return send(res, 503, { error: 'Inventory unavailable' });
    const campaigns = await r.json();
    const soldPixels = campaigns.reduce((n, c) => n + Number(c.width || 0) * Number(c.height || 0), 0);
    return send(res, 200, { board: 'molt-beach', total_pixels: 1000000, sold_pixels: soldPixels, campaigns });
  } catch (error) {
    return send(res, 503, { error: 'Inventory unavailable' });
  }
}

function serveFile(res, file) {
  if (!fs.existsSync(file)) return false;
  const payload = fs.readFileSync(file);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': String(payload.length)
  });
  res.end(payload);
  return true;
}

function serveHomepage(res) {
  if (!fs.existsSync(INDEX_FILE)) return false;
  let html = fs.readFileSync(INDEX_FILE, 'utf8');
  const banner = '<section id="featured-edh" style="margin:24px 0;padding:24px;border:1px solid #f2c14e;border-radius:18px;background:#111;display:flex;justify-content:space-between;gap:20px;align-items:center;flex-wrap:wrap"><div><div style="color:#f2c14e;text-transform:uppercase;letter-spacing:.14em;font-size:.68rem;font-weight:900">MTG / LIVE OFFER</div><h2 style="margin:.45rem 0;font-size:2rem">Bespoke Artisan EDH Commander Deck</h2><p style="margin:0;color:#999">100-card Commander deck plus curated reserve package. Verified available supply.</p></div><div style="text-align:right"><div style="font-size:2rem;font-weight:1000;color:#f2c14e">NZ$385</div><a href="' + BESPOKE_LINK + '" style="display:inline-block;margin-top:10px;padding:13px 18px;border-radius:10px;background:#f2c14e;color:#111;font-weight:900">Buy with Stripe</a></div></section>';
  if (!html.includes('id="featured-edh"')) {
    if (html.includes('<main>')) html = html.replace('<main>', '<main>' + banner);
    else html = banner + html;
  }
  const payload = Buffer.from(html, 'utf8');
  res.writeHead(200, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Length':String(payload.length)});
  res.end(payload);
  return true;
}

http.createServer = function publicRoutesCompatibleCreateServer(handler) {
  const wrapped = typeof handler === 'function'
    ? async function(req, res) {
        const route = String(req.url || '').split('?')[0];
        if (req.method === 'GET' && route === '/') {
          if (serveHomepage(res)) return;
        }
        if (req.method === 'GET' && (route === '/mtg' || route === '/mtg/')) {
          if (serveFile(res, BESPOKE_MTG_FILE)) return;
          if (serveFile(res, MTG_FILE)) return;
        }
        if (req.method === 'GET' && (route === '/board' || route === '/board/')) {
          if (serveFile(res, BOARD_FILE)) return;
        }
        if (req.method === 'GET' && route === '/api/molt-beach-inventory') {
          await inventory(res);
          return;
        }
        return handler(req, res);
      }
    : handler;
  return originalCreateServer.call(this, wrapped);
};
