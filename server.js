const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function safePath(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath.split('?')[0]); } catch (_) { return null; }
  if (!decoded.startsWith('/')) return null;
  const relative = decoded.replace(/^\/+/, '');
  const full = path.resolve(ROOT, relative);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null;
  return full;
}

function send(res, status, body, contentType) {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method Not Allowed\n', 'text/plain; charset=utf-8');
    return;
  }

  const requestPath = (req.url || '/').split('?')[0];

  if (requestPath === '/healthz') {
    send(res, 200, JSON.stringify({
      status: 'ok',
      service: 'DreamLedger 1',
      service_id: 'SRV-D8UD55LCKFVC73F1T4EG',
      commit: process.env.RENDER_GIT_COMMIT || 'local'
    }) + '\n', 'application/json; charset=utf-8');
    return;
  }

  const filePath = safePath(requestPath);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    send(res, 404, 'Not Found\n', 'text/plain; charset=utf-8');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`DreamLedger 1 listening on ${HOST}:${PORT}`);
});
