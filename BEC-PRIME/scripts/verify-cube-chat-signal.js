'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const base = (process.env.PRODUCTION_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const timeoutMs = Number(process.env.PRODUCTION_VERSION_TIMEOUT_MS || 15000);
const proofDir = path.join(__dirname, '..', 'data', 'proofs');
const proofPath = path.join(proofDir, 'CUBE-CHAT-SIGNAL-PROOF.json');

function request(method, requestPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = https.request(base + requestPath, {
      method,
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'DreamLedger-CUBE-Chat-Verifier/1.0',
        ...(payload ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        } : {})
      }
    }, res => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        let json = {};
        try { json = raw ? JSON.parse(raw) : {}; } catch {}
        resolve({
          status: res.statusCode,
          allowOrigin: res.headers['access-control-allow-origin'] || null,
          allowMethods: res.headers['access-control-allow-methods'] || null,
          json
        });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  const checks = [];
  const options = await request('OPTIONS', '/api/cube/chat-signal');
  checks.push({
    name: 'options_cors',
    pass: options.status === 204 &&
      options.allowOrigin === '*' &&
      String(options.allowMethods || '').includes('POST')
  });

  const malformed = await request('POST', '/api/cube/chat-signal', {});
  checks.push({
    name: 'malformed_post_rejected',
    pass: malformed.status === 422 &&
      malformed.json.error === 'message is required' &&
      malformed.json.economic_truth === undefined
  });

  const proof = {
    schema: 'dreamledger/cube-chat-signal-proof/v1',
    verdict: checks.every(x => x.pass) ? 'PASS' : 'FAIL',
    base,
    endpoint: '/api/cube/chat-signal',
    signal_creation_tested: false,
    economic_truth_created: false,
    checks
  };

  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
  if (proof.verdict !== 'PASS') process.exit(1);
})().catch(err => {
  const proof = {
    schema: 'dreamledger/cube-chat-signal-proof/v1',
    verdict: 'FAIL',
    base,
    endpoint: '/api/cube/chat-signal',
    signal_creation_tested: false,
    economic_truth_created: false,
    error: err.message
  };
  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.error(JSON.stringify(proof, null, 2));
  process.exit(1);
});
