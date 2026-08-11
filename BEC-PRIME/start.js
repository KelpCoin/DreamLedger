'use strict';

// Canonical Render entrypoint.
// Wires Dreamiez accounts, Elohim v6, Gauntlet v6, and the approval-gated Digital Proxy around commerce.
const http = require('http');
const dreamiezAccount = require('./dreamiez-account');
const controlPlane = require('./runtime/ControlPlane');

const originalCreateServer = http.createServer;
let capturedServer = null;

http.createServer = function wrappedCreateServer(...args) {
  const originalHandler = args[0];
  args[0] = async function dreamiezRuntimeHandler(req, res) {
    if (await dreamiezAccount.handle(req, res)) return;
    if (await controlPlane.handle(req, res)) return;

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

const boot = controlPlane.boot();
console.log(JSON.stringify({ control_plane_boot: boot }, null, 2));
if (boot.status !== 'PASS') {
  throw new Error('Elohim/Gauntlet boot gate failed; refusing to start runtime');
}

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
