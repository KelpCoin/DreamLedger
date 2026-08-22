'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const originalCreateServer = http.createServer;
const PUBLIC_ROOT = path.join(__dirname, '..', 'compiled', 'website');
const MTG_FILE = path.join(PUBLIC_ROOT, 'mtg', 'index.html');
function sendNotFound(res){
  res.writeHead(404, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify({error:'Not found'}));
  return true;
}
function serveMtg(req, res) {
  if (!req || req.method !== 'GET') return false;
  const raw = String(req.url || '').split('?')[0];
  if (raw === '/cinema.html' || raw === '/cinema' || raw === '/dreamiez' || raw === '/dreamiez/' || raw.startsWith('/dreamiez/')) return sendNotFound(res);
  if (raw !== '/mtg' && raw !== '/mtg/') return false;
  if (!fs.existsSync(MTG_FILE)) return false;
  const payload = fs.readFileSync(MTG_FILE);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': String(payload.length)
  });
  res.end(payload);
  return true;
}
http.createServer = function mtgRouteCompatibleCreateServer(handler) {
  const wrapped = typeof handler === 'function'
    ? function(req, res) {
        if (serveMtg(req, res)) return;
        return handler(req, res);
      }
    : handler;
  return originalCreateServer.call(this, wrapped);
};
