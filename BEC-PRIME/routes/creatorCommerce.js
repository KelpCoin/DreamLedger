'use strict';

const factory = require('../creator/CreatorCommerceFactory');

function send(res, status, body) {
  if (res.writableEnded) return true;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
  return true;
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 200000) throw Object.assign(new Error('REQUEST_TOO_LARGE'), { statusCode: 413 });
  }
  try { return JSON.parse(raw || '{}'); } catch { throw Object.assign(new Error('INVALID_JSON'), { statusCode: 400 }); }
}

async function handle(req, res, url) {
  if (url === '/api/creator/snapshot' && req.method === 'GET') return send(res, 200, factory.snapshot());
  if (url === '/api/creator/word' && req.method === 'POST') {
    try { const b = await body(req); return send(res, 200, factory.upsertWord(b.word, b)); } catch (e) { return send(res, e.statusCode || 400, { error: e.message }); }
  }
  if (url === '/api/creator/vote' && req.method === 'POST') {
    try { const b = await body(req); return send(res, 200, factory.vote(b.word, b.direction, b.reputation)); } catch (e) { return send(res, e.statusCode || 400, { error: e.message }); }
  }
  if (url === '/api/creator/signal' && req.method === 'POST') {
    try { const b = await body(req); return send(res, 200, factory.applySignal(b)); } catch (e) { return send(res, e.statusCode || 400, { error: e.message }); }
  }
  if (url === '/api/creator/stencil' && req.method === 'POST') {
    try { return send(res, 200, factory.createStencil(await body(req))); } catch (e) { return send(res, e.statusCode || 400, { error: e.message }); }
  }
  if (url === '/api/creator/recipe' && req.method === 'POST') {
    try { return send(res, 200, factory.createRecipe(await body(req))); } catch (e) { return send(res, e.statusCode || 400, { error: e.message }); }
  }
  const render = url.match(/^\/api\/creator\/stencil\/([^/]+)\/render$/);
  if (render && req.method === 'POST') {
    try { return send(res, 200, factory.renderStencil(decodeURIComponent(render[1]))); } catch (e) { return send(res, e.statusCode || 404, { error: e.message }); }
  }
  return false;
}

module.exports = { handle };
