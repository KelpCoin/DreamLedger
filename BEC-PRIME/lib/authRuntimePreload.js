'use strict';

// Inject the persistent auth router before start.js loads its historical
// Dreamiez account module. This keeps the public module path stable while
// ensuring /api/account/* uses real persistent sessions.
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
        if (await auth.handle(req, res, url)) return true;
        return legacy.handle(req, res, url);
      }
    };
  }
  return originalLoad.apply(this, arguments);
};
