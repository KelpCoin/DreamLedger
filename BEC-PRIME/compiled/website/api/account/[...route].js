'use strict';

// Vercel-hosted account function. Keep every runtime dependency inside the
// Vercel deployment root so the function can be bundled independently of
// Render and the rest of the repository.
const auth = require('./auth');

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
