'use strict';

// Force one canonical persistent account implementation in every Node start.
// The public /api/account/* routes are handled by routes/auth.js before the
// historical Dreamiez router can create anonymous users. Avatar APIs use the
// canonical Supabase-backed avatar runtime before the legacy router.
const Module = require('module');
const path = require('path');
const originalLoad = Module._load;
const legacyPath = path.resolve(__dirname, '..', 'dreamiez-account.js');
const auth = require(path.resolve(__dirname, '..', 'routes', 'auth.js'));
const avatarCanonical = require(path.resolve(__dirname, '..', 'routes', 'avatarCanonical.js'));

Module._load = function(request, parent, isMain) {
  if (request === './dreamiez-account' && parent && path.resolve(parent.filename) === path.resolve(__dirname, '..', 'start.js')) {
    const legacy = originalLoad(legacyPath, parent, false);
    return {
      async handle(req, res, url) {
        const route = typeof url === 'string' ? url : String(req.url || '').split('?')[0];
        if (route.startsWith('/api/account/')) {
          const handled = await auth.handle(req, res, route);
          if (handled) return true;
        }
        if (route === '/api/dreamiez/me' || route === '/api/dreamiez/cosmetics' || route.startsWith('/api/dreamiez/avatar')) {
          try {
            const handled = await avatarCanonical.handle(req, res, route);
            if (handled) return true;
          } catch (err) {
            if (err && err.statusCode) {
              if (!res.writableEnded) {
                res.writeHead(err.statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
                res.end(JSON.stringify({ error: err.message || 'Avatar request failed' }));
              }
              return true;
            }
            throw err;
          }
        }
        return legacy.handle(req, res, route);
      }
    };
  }
  return originalLoad.apply(this, arguments);
};
