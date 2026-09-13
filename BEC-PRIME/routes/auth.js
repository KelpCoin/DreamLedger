'use strict';

// Stable route adapter used by start.js. Account auth and cross-game identity
// both live behind this import seam so legacy Dreamiez routing cannot create a
// competing identity path.
const accountAuth = require('../compiled/website/lib/accountAuth');
const kelplantisIdentity = require('./kelplantisIdentity');

async function handle(req, res, url) {
  if (await kelplantisIdentity.handle(req, res, url)) return true;
  return accountAuth.handle(req, res, url);
}

module.exports = { handle };
