'use strict';

// Vercel serverless adapter for the canonical Dreamiez account routes.
// The legacy Node runtime stores local JSON state; Vercel functions have a
// read-only deployment filesystem, so hosted smoke/auth state uses /tmp.
// This is a runtime compatibility bridge, not a durable production datastore.
process.env.DREAMIEZ_DATA_DIR = process.env.DREAMIEZ_DATA_DIR || '/tmp/dreamledger-dreamiez';

const dreamiez = require('../../BEC-PRIME/routes/dreamiez');

module.exports = async function accountRoute(req, res) {
  try {
    const handled = await dreamiez.handle(req, res, String(req.url || '').split('?')[0]);
    if (handled) return;
    if (!res.writableEnded) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Account route not found' }));
    }
  } catch (err) {
    console.error('DreamLedger account function failed:', err);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err && err.message ? err.message : 'Account function failed' }));
    }
  }
};
