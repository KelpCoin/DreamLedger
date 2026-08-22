'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const originalCreateServer = http.createServer;
const PUBLIC_ROOT = path.join(__dirname, '..', 'compiled', 'website');
const MTG_FILE = path.join(PUBLIC_ROOT, 'mtg', 'index.html');
const BOARD_FILE = path.join(PUBLIC_ROOT, 'board.html');

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

http.createServer = function publicRoutesCompatibleCreateServer(handler) {
  const wrapped = typeof handler === 'function'
    ? async function(req, res) {
        const route = String(req.url || '').split('?')[0];
        if (req.method === 'GET' && (route === '/mtg' || route === '/mtg/')) {
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
