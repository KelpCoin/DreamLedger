'use strict';

// Deterministic account contract smoke test. No external credentials.
process.env.DREAMLEDGER_AUTH_LOCAL_TEST = '1';
const fs = require('fs');
const os = require('os');
const path = require('path');
const stream = require('stream');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-account-smoke-'));
process.env.DREAMIEZ_DATA_DIR = dataDir;
const handler = require('../compiled/website/api/account/[...route].js');

function invoke(method, url, payload, cookie) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const req = stream.Readable.from(payload ? [JSON.stringify(payload)] : []);
    req.method = method;
    req.url = url;
    req.headers = { cookie: cookie || '', 'content-type': 'application/json' };
    const res = {
      writableEnded: false,
      headers: {},
      statusCode: 200,
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, Object.fromEntries(Object.entries(headers).map(([k,v]) => [k.toLowerCase(), v]))); },
      end(body) { this.writableEnded = true; if (body) chunks.push(Buffer.from(String(body))); resolve({ status: this.statusCode, headers: this.headers, body: JSON.parse(Buffer.concat(chunks).toString() || '{}') }); }
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

(async () => {
  const email = 'smoke-' + Date.now() + '@example.com';
  const password = 'SmokePassword123!';
  const registered = await invoke('POST', '/api/account/register', { name: 'Smoke User', email, password });
  if (registered.status !== 201 || !registered.body.ok) throw new Error('REGISTER_FAIL');
  const cookie = registered.headers['set-cookie'];
  if (!cookie) throw new Error('SESSION_COOKIE_FAIL');
  const me = await invoke('GET', '/api/account/me', null, cookie);
  if (me.status !== 200 || !me.body.authenticated) throw new Error('ME_FAIL');
  const update = await invoke('POST', '/api/account/update', { name: 'Updated Smoke User', avatar: { height: 3, build: 3, skin: 4 } }, cookie);
  if (update.status !== 200 || !update.body.ok) throw new Error('UPDATE_FAIL');
  const loggedOut = await invoke('POST', '/api/account/logout', {}, cookie);
  if (loggedOut.status !== 200 || !loggedOut.body.ok) throw new Error('LOGOUT_FAIL');
  const login = await invoke('POST', '/api/account/login', { email, password });
  if (login.status !== 200 || !login.body.ok) throw new Error('LOGIN_FAIL');
  console.log(JSON.stringify({ status: 'PASS', register: 201, me: 200, update: 200, logout: 200, login: 200 }));
})().catch(err => { console.error(err.stack || err); process.exit(1); });
