'use strict';

const { hunt, loadWanted, buildEbayQuery } = require('../hunt/HuntEngine');

function jsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50000) req.destroy(new Error('Request too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

async function handle(req, res, requestPath) {
  if (requestPath !== '/api/hunt' || req.method !== 'POST') return false;
  try {
    const input = await jsonBody(req);
    let wanted = input.wanted || null;
    if (!wanted && input.wantedId) wanted = loadWanted(String(input.wantedId));
    if (!wanted) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ status: 'FAILED', error: 'wanted or wantedId is required' }));
      return true;
    }
    const result = await hunt(wanted, {
      wantedId: input.wantedId || wanted.id || null,
      ebay: {
        token: input.ebayToken || process.env.EBAY_OAUTH_TOKEN,
        limit: input.limit || 50
      }
    });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(result));
    return true;
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ status: 'FAILED', error: err.message || 'hunt failed' }));
    return true;
  }
}

module.exports = { handle, buildEbayQuery };
