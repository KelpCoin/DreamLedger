'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.WANTED_DATA_DIR || path.join(__dirname, '..', 'data', 'wanted');
const DATA_FILE = path.join(DATA_DIR, 'wanted-items.jsonl');

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '', 'utf8');
}

function readItems() {
  ensureStore();
  return fs.readFileSync(DATA_FILE, 'utf8').split(/\r?\n/).filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function appendItem(item) {
  ensureStore();
  fs.appendFileSync(DATA_FILE, JSON.stringify(item) + '\n', 'utf8');
}

function parseWantedText(text) {
  const raw = String(text || '').trim();
  const lower = raw.toLowerCase();
  const max = lower.match(/(?:under|below|max(?:imum)?|up to)\s*\$?\s*([0-9]+(?:\.[0-9]+)?)/i);
  const sizes = [...raw.matchAll(/\b(XXS|XS|S|M|L|XL|XXL|2XL|XXXL|3XL|4XL)\b/gi)].map(m => m[1].toUpperCase());
  const years = [...raw.matchAll(/\b(19[5-9][0-9]|20[0-2][0-9])\b/g)].map(m => m[1]);
  const styles = ['vintage','oversized','retro','streetwear','varsity','colour-block','color-block','denim','rare','discontinued'];
  const detectedStyles = styles.filter(s => lower.includes(s));
  const brandMatch = raw.match(/\b(FUBU|Nike|Adidas|Levi'?s|Diesel|Carhartt|Patagonia|Supreme)\b/i);
  return {
    raw_text: raw,
    brand: brandMatch ? brandMatch[1] : null,
    size: [...new Set(sizes)].join(', ') || null,
    era: [...new Set(years)].join(', ') || null,
    style: [...new Set(detectedStyles)].join(', ') || null,
    max_price: max ? Number(max[1]) : null,
    currency: lower.includes('nzd') || lower.includes('nz$') ? 'NZD' : 'NZD',
    intent_type: lower.includes('exact') ? 'EXACT' : 'BEST_MATCH',
    status: 'WANTED'
  };
}

function jsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 100000) req.destroy(new Error('Request too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  if (res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function html(res) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WANTED - Demand Inbox</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:32px;background:#0b0b0d;color:#f5f5f5}textarea,input,button{font:inherit;width:100%;box-sizing:border-box;border-radius:12px;padding:14px;margin-top:10px}textarea,input{background:#17171b;color:#fff;border:1px solid #333}button{background:#fff;color:#000;border:0;font-weight:700;cursor:pointer}.card{border:1px solid #333;border-radius:16px;padding:18px;margin-top:18px;background:#121216}.muted{color:#aaa}h1{font-size:42px;margin-bottom:4px}</style></head><body><h1>WANTED</h1><p class="muted">Tell the agent what you want. Do not search for it yourself.</p><textarea id="want" rows="7" placeholder="Example: FUBU jacket, XL or 2XL, vintage 1990s/2000s, black or red, under NZ$120"></textarea><button id="submit">Create WANTED</button><div id="result"></div><script>document.getElementById('submit').onclick=async()=>{const text=document.getElementById('want').value.trim();if(!text)return;const r=await fetch('/api/wanted',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text})});const d=await r.json();document.getElementById('result').innerHTML='<div class="card"><b>WANTED '+d.item.id+'</b><p>'+d.item.raw_text.replace(/</g,'&lt;')+'</p><p class="muted">Brand: '+(d.item.brand||'unknown')+' | Size: '+(d.item.size||'flexible')+' | Max: '+(d.item.max_price===null?'not set':d.item.currency+' '+d.item.max_price)+'</p><p>Status: WANTED. Hunt engine is the next adapter.</p></div>';};</script></body></html>`;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

async function handle(req, res, requestPath) {
  if (requestPath === '/wanted' && req.method === 'GET') { html(res); return true; }
  if (requestPath === '/api/wanted' && req.method === 'GET') { return send(res, 200, { items: readItems() }); }
  if (requestPath === '/api/wanted' && req.method === 'POST') {
    try {
      const body = await jsonBody(req);
      const text = String(body.text || body.raw_text || '').trim();
      if (!text) return send(res, 400, { error: 'text is required' });
      const parsed = parseWantedText(text);
      const item = {
        id: 'W-' + crypto.randomBytes(6).toString('hex'),
        created_at: new Date().toISOString(),
        source_type: body.source_type || 'plain_text',
        source_platform: body.source_platform || 'universal',
        ...parsed
      };
      appendItem(item);
      return send(res, 201, { status: 'CREATED', item });
    } catch (err) { return send(res, 400, { error: err.message || 'Invalid wanted request' }); }
  }
  return false;
}

module.exports = { handle, parseWantedText, DATA_FILE };
