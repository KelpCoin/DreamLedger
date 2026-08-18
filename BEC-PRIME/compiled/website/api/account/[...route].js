'use strict';

// Vercel function entrypoint only. Keep implementation outside /api so
// Vercel does not discover helper modules as separate functions.
const auth = require('../../lib/accountAuth');

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
