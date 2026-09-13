'use strict';

// Stable route adapter used by start.js. Account auth and cross-game identity
// both live behind this import seam so legacy Dreamiez routing cannot create a
// competing identity path.
const accountAuth = require('../compiled/website/lib/accountAuth');
const kelplantisIdentity = require('./kelplantisIdentity');
const sessionCookie = require('../lib/sessionCookie');

function requestForLegacyAuth(req) {
  const accountId = sessionCookie.get(req);
  if (!accountId) return req;
  const headers = Object.assign({}, req.headers, {
    cookie: 'dreamiez_session=' + encodeURIComponent(accountId)
  });
  const proxy = Object.create(req);
  proxy.headers = headers;
  return proxy;
}

function adaptSetCookie(res) {
  const original = res.setHeader;
  res.setHeader = function(name, value) {
    if (String(name).toLowerCase() === 'set-cookie') {
      const values = Array.isArray(value) ? value : [value];
      const converted = values.map(cookieValue => {
        const raw = String(cookieValue);
        const match = raw.match(/^dreamiez_session=([^;]*)(.*)$/);
        if (!match) return raw;
        let id = null;
        try { id = decodeURIComponent(match[1]); } catch { id = null; }
        if (!id) return raw;
        if (/Max-Age=0(?:;|$)/i.test(match[2])) {
          return sessionCookie.COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax';
        }
        return sessionCookie.COOKIE + '=' + sessionCookie.encode(id) + '; Path=/; Max-Age=' + sessionCookie.MAX_AGE + '; HttpOnly; Secure; SameSite=Lax';
      });
      return original.call(this, name, Array.isArray(value) ? converted : converted[0]);
    }
    return original.call(this, name, value);
  };
  return original;
}

async function handle(req, res, url) {
  if (await kelplantisIdentity.handle(req, res, url)) return true;

  const originalSetHeader = adaptSetCookie(res);
  try {
    return await accountAuth.handle(requestForLegacyAuth(req), res, url);
  } finally {
    res.setHeader = originalSetHeader;
  }
}

module.exports = { handle };
