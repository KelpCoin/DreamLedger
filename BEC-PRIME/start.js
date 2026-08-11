'use strict';

// Canonical Render entrypoint.
// Adds the Dreamiez account/streak control plane around the existing commerce server.
const http = require('http');
const dreamiezAccount = require('./dreamiez-account');

const originalCreateServer = http.createServer;
let capturedServer = null;

http.createServer = function wrappedCreateServer(...args) {
  const originalHandler = args[0];
  args[0] = async function dreamiezRuntimeHandler(req, res) {
    if (await dreamiezAccount.handle(req, res)) return;

    const requestPath = String(req.url || '').split('?')[0];
    if (req.method === 'GET' && requestPath === '/') {
      const originalEnd = res.end;
      res.end = function injectedEnd(chunk, encoding, callback) {
        try {
          const contentType = String(res.getHeader('Content-Type') || '');
          if (chunk && contentType.includes('text/html')) {
            let html = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
            html = html.replace('</body>', '<script src="/assets/dreamiez-account.js"></script></body>');
            return originalEnd.call(this, html, 'utf8', callback);
          }
        } catch (err) {
          console.error('Dreamiez account UI injection failed:', err.message);
        }
        return originalEnd.call(this, chunk, encoding, callback);
      };
    }
    return originalHandler(req, res);
  };
  capturedServer = originalCreateServer.apply(this, args);
  return capturedServer;
};

require('./server.js');

if (!capturedServer) {
  throw new Error('BEC-PRIME server did not create an HTTP server');
}

if (!capturedServer.listening) {
  const port = Number(process.env.PORT || 3000);
  capturedServer.listen(port, '0.0.0.0', () => {
    console.log(`DreamLedger commerce runtime listening on 0.0.0.0:${port}`);
  });
}
