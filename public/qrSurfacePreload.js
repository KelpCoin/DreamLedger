'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const original = http.createServer;
const ROOT = __dirname;
const QR_FILE = path.join(ROOT, 'assets', 'qr-overpaying-power.svg');
const QR_TARGET = 'https://dreamledger.org/overpaying?utm_source=qr&utm_medium=print&utm_campaign=power_verify';
const EXCLUDED = new Set(['/login','/login/','/login.html','/register','/register/','/register.html','/account','/account/','/account.html']);

function qrMarkup() {
  return '<div id="dreamledger-qr-overpaying-power" data-qr-target="' + QR_TARGET + '" style="position:fixed;right:14px;bottom:14px;z-index:9998;width:86px;height:86px;padding:6px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.35);overflow:hidden"><a href="/overpaying?utm_source=qr&utm_medium=print&utm_campaign=power_verify" aria-label="Open Truth Oracle overpaying doorway"><img src="/assets/qr-overpaying-power.svg" alt="Scan to find out if you are overpaying" width="86" height="86" style="width:100%;height:100%;display:block"></a></div>';
}

function standaloneQr() {
  return '<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Truth Oracle QR | DreamLedger</title><meta name="description" content="Canonical DreamLedger QR acquisition surface for the Truth Oracle overpaying doorway."></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#080a0d;color:#eef1f5;font-family:system-ui,sans-serif"><main style="text-align:center;padding:24px"><img src="/assets/qr-overpaying-power.svg" alt="Scan to find out if you are overpaying" width="420" height="420" style="max-width:88vw;height:auto;background:#fff;padding:12px;border-radius:12px"><h1 style="font-size:22px">Scan to find out if you are overpaying</h1><p><a href="/overpaying?utm_source=qr&utm_medium=print&utm_campaign=power_verify" style="color:#fcd535">Open Truth Oracle</a></p></main></body></html>';
}

http.createServer = function qrSurfaceCreateServer(...args) {
  const listener = typeof args[0] === 'function' ? args[0] : args[1];
  if (typeof listener !== 'function') return original.apply(this, args);

  const wrapped = async function qrSurfaceHandler(req, res) {
    const route = String(req.url || '/').split('?')[0];

    if (req.method === 'GET' && route === '/assets/qr-overpaying-power.svg') {
      if (!fs.existsSync(QR_FILE)) {
        res.statusCode = 404;
        return res.end('Not Found');
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('X-DreamLedger-QR', 'overpaying-power-v1');
      return res.end(fs.readFileSync(QR_FILE));
    }

    if (req.method === 'GET' && route === '/qr/overpaying') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-DreamLedger-QR', 'overpaying-power-v1');
      return res.end(standaloneQr());
    }

    const originalEnd = res.end.bind(res);
    res.end = function patchedEnd(chunk, encoding, callback) {
      const contentType = String(res.getHeader('content-type') || '');
      const isHtml = contentType.toLowerCase().includes('text/html');
      if (isHtml && chunk && !EXCLUDED.has(route)) {
        let html;
        try { html = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk); } catch { html = null; }
        if (html && html.includes('</body>') && !html.includes('dreamledger-qr-overpaying-power')) {
          chunk = html.replace('</body>', qrMarkup() + '</body>');
          if (encoding && typeof encoding === 'function') callback = encoding;
          encoding = 'utf8';
        }
      }
      return originalEnd(chunk, encoding, callback);
    };

    res.setHeader('X-DreamLedger-QR-Surface', 'overpaying-power-v1');
    return listener(req, res);
  };

  if (typeof args[0] === 'function') return original.call(this, wrapped);
  args[1] = wrapped;
  return original.apply(this, args);
};
