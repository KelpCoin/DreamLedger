'use strict';

// Canonical DreamLedger account API. Dreamiez is optional and is never the
authentication authority for the primary website account.
// The compiled account runtime uses Supabase in production and local files
// only when DREAMLEDGER_AUTH_LOCAL_TEST=1. Do not reintroduce /tmp storage
// into the production authentication path.
const auth = require('../../BEC-PRIME/compiled/website/lib/accountAuth');

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
