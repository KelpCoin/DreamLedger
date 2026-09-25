'use strict';

/**
 * QR surface preload — PRINT / physical acquisition only.
 *
 * DO NOT inject a floating QR on normal website pages.
 * If someone is already on dreamledger.org, a QR is useless and wrong.
 * Canonical print surface: GET /qr/overpaying
 * Asset: /assets/qr-overpaying-power.svg (if present)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const original = http.createServer;
const ROOT = __dirname;
const QR_FILE = path.join(ROOT, 'assets', 'qr-overpaying-power.svg');

function standaloneQr() {
  return (
    '<!doctype html><html lang="en-NZ"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>QR · DreamLedger</title></head>' +
    '<body style="margin:0;min-height:100vh;display:grid;place-items:center;' +
    'background:#fff;color:#111;font-family:system-ui,sans-serif">' +
    '<main style="text-align:center;padding:24px">' +
    (fs.existsSync(QR_FILE)
      ? '<img src="/assets/qr-overpaying-power.svg" alt="QR" width="320" height="320" style="max-width:88vw;height:auto">'
      : '<p>QR asset not installed on this host.</p>') +
    '<p style="margin-top:16px"><a href="/">Back to shop</a></p>' +
    '</main></body></html>'
  );
}

http.createServer = function qrSurfaceCreateServer(...args) {
  const listener = typeof args[0] === 'function' ? args[0] : args[1];
  if (typeof listener !== 'function') return original.apply(this, args);

  const wrapped = async function qrSurfaceHandler(req, res) {
    const route = String(req.url || '/').split('?')[0];

    // Serve asset only — no HTML injection on other routes
    if (req.method === 'GET' && route === '/assets/qr-overpaying-power.svg') {
      if (!fs.existsSync(QR_FILE)) {
        res.statusCode = 404;
        return res.end('Not Found');
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.end(fs.readFileSync(QR_FILE));
    }

    if (req.method === 'GET' && route === '/qr/overpaying') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(standaloneQr());
    }

    // Intentionally do NOT patch res.end to inject floating QR.
    return listener(req, res);
  };

  if (typeof args[0] === 'function') {
    return original.call(this, wrapped);
  }
  args[1] = wrapped;
  return original.apply(this, args);
};

module.exports = { disabledFloatingQr: true };
