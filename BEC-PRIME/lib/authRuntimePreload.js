'use strict';

// Force one canonical persistent account implementation in every Node start.
// The public /api/account/* routes are handled by routes/auth.js before the
// historical Dreamiez router can create anonymous users.
const Module = require('module');
const path = require('path');
const originalLoad = Module._load;
const legacyPath = path.resolve(__dirname, '..', 'dreamiez-account.js');
const auth = require(path.resolve(__dirname, '..', 'routes', 'auth.js'));

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
        return legacy.handle(req, res, route);
      }
    };
  }
  return originalLoad.apply(this, arguments);
};
