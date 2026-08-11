'use strict';

// Canonical Render entrypoint.
// Loads the existing commerce server and guarantees that its http.Server
// is listening on Render's PORT and on all interfaces.
const http = require('http');

const originalCreateServer = http.createServer;
let capturedServer = null;

http.createServer = function wrappedCreateServer(...args) {
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
