'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-account-smoke-'));
process.env.DREAMIEZ_DATA_DIR = tmp;
const handler = require('../api/account/[...route].js');

function invoke(method, url, payload, cookie) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const req = require('stream').Readable.from(payload ? [JSON.stringify(payload)] : []);
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
  if (registered.status !== 201 || !registered.body.ok) throw new Error('register failed: ' + JSON.stringify(registered));
  const cookie = registered.headers['set-cookie'];
  if (!cookie) throw new Error('register did not set session cookie');
  const me = await invoke('GET', '/api/account/me', null, cookie);
  if (me.status !== 200 || !me.body.authenticated) throw new Error('me failed: ' + JSON.stringify(me));
  const loggedOut = await invoke('POST', '/api/account/logout', {}, cookie);
  if (loggedOut.status !== 200 || !loggedOut.body.ok) throw new Error('logout failed: ' + JSON.stringify(loggedOut));
  const login = await invoke('POST', '/api/account/login', { email, password });
  if (login.status !== 200 || !login.body.ok) throw new Error('login failed: ' + JSON.stringify(login));
  console.log(JSON.stringify({ status: 'PASS', register: registered.status, me: me.status, logout: loggedOut.status, login: login.status }));
})().catch(err => { console.error(err.stack || err); process.exit(1); });
