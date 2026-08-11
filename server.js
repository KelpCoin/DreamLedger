// DreamLedger compatibility launcher.
// Some Render service configurations start from repository root instead of
// applying render.yaml rootDir. Always delegate to the canonical BEC-PRIME
// commerce server so both configurations serve the same production runtime.
require('./BEC-PRIME/server.js');
