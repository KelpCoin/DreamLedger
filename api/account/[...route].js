'use strict';

// Canonical DreamLedger account API. Dreamiez is optional and is never the
// authentication authority for the primary website account.
process.env.DREAMIEZ_DATA_DIR = process.env.DREAMIEZ_DATA_DIR || '/tmp/dreamledger-account';

const auth = require('../../BEC-PRIME/routes/auth');

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
    console.error('DreamLedger account function failed:', err);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err && err.message ? err.message : 'Account function failed' }));
    }
  }
};
