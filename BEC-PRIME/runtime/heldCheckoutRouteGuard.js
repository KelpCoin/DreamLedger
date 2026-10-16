'use strict';

const HELD_ROUTE_PATHS = new Set([
  '/buy/COMMANDER-DECK-DIAGNOSTIC-001',
  '/buy/commander-deck-diagnostic-001',
  '/buy/cmd-diag-29'
]);

const HELD_PAGE = '<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>Offer currently held | DreamLedger</title><style>body{margin:0;background:#0a0b0f;color:#f4f1ea;font:16px/1.6 system-ui,sans-serif}.wrap{max-width:680px;margin:12vh auto;padding:24px}.panel{padding:28px;border:1px solid #303746;border-radius:16px;background:#151922}p{color:#a4abba}a{color:#d8b56b}.held{border:1px solid #303746;border-radius:10px;padding:10px 14px;background:#151922;color:#a4abba;opacity:.7;cursor:not-allowed}</style></head><body><main class="wrap"><div class="panel"><h1>Offer currently held</h1><p>The Commander Deck Diagnostic is not available for purchase. Settlement attribution, fulfillment, and delivery proof have not passed the release gate.</p><p><button type="button" class="held" disabled aria-disabled="true">Checkout held</button></p><p><a href="/mtg/">Return to the MTG marketplace</a></p></div></main></body></html>';

function responseFor(method, pathname) {
  if (method !== 'GET' || !HELD_ROUTE_PATHS.has(pathname)) return null;
  return {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-DreamLedger-Commerce-State': 'HELD'
    },
    body: HELD_PAGE
  };
}

function handle(req, res, pathname) {
  const response = responseFor(req.method, pathname);
  if (!response) return false;
  res.writeHead(response.status, response.headers);
  res.end(response.body);
  return true;
}

module.exports = { HELD_ROUTE_PATHS, HELD_PAGE, responseFor, handle };
