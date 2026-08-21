'use strict';

const { verify } = require('../trust/InternalTrustService');

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 200000) throw new Error('Request too large');
  }
  try {
    return JSON.parse(raw || '{}');
  } catch {
    throw new Error('Invalid JSON');
  }
}

function authorized(req) {
  const configured = process.env.DREAMLEDGER_INTERNAL_TRUST_TOKEN || '';
  const supplied = String(req.headers['x-dreamledger-internal-token'] || '');
  return Boolean(configured) && supplied === configured;
}

async function handle(req, res, requestPath) {
  if (requestPath !== '/api/internal/trust/verify') return false;
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return true;
  }
  if (!authorized(req)) {
    res.writeHead(process.env.DREAMLEDGER_INTERNAL_TRUST_TOKEN ? 401 : 503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: process.env.DREAMLEDGER_INTERNAL_TRUST_TOKEN ? 'Unauthorized' : 'Internal trust service not configured' }));
    return true;
  }
  try {
    const body = await readJson(req);
    const verification = await verify(body.candidate);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ verification }, null, 2));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: err.message || 'Trust verification failed' }));
  }
  return true;
}

module.exports = { handle };
