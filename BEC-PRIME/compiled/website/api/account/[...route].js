'use strict';

// Vercel-hosted account function for the compiled DreamLedger storefront.
// This mirrors the canonical account implementation instead of depending on
// the Render process. Account storage uses the runtime data directory chosen
// by the canonical auth module.
process.env.DREAMIEZ_DATA_DIR = process.env.DREAMIEZ_DATA_DIR || '/tmp/dreamledger-account';

const auth = require('../../../../routes/auth');

module.exports = async function accountRoute(req, res) {
  try {
    const handled = await auth.handle(req, res, String(req.url || '').split('?')[0]);
    if (handled) return;
    if (!res.writableEnded) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Account route not found' }));
    }
  } catch (err) {
    console.error('DreamLedger Vercel account function failed:', err);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err && err.message ? err.message : 'Account function failed' }));
    }
  }
};
