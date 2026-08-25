'use strict';

const trust = require('../lib/trustAttestation');

function send(res, status, body) {
  if (res.writableEnded) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 200000) throw new Error('Request too large');
  }
  return JSON.parse(raw || '{}');
}

async function handle(req, res, url) {
  if (req.method === 'GET' && url === '/api/trust/status') {
    return send(res, 200, {
      service: 'DreamLedger Trust Attestation',
      schema: trust.SCHEMA,
      cryptography: 'SHA-256 evidence hash + optional Ed25519 signature',
      external_payment_required_for_pass: true,
      current_state: process.env.TRUST_ATTESTATION_PRIVATE_KEY_PEM ? 'SIGNING_CONFIGURED' : 'INSUFFICIENT_EVIDENCE'
    });
  }

  if (req.method === 'POST' && url === '/api/trust/verify') {
    try {
      const input = await body(req);
      const attestation = trust.buildAttestation(input);
      const statusCode = attestation.status === 'FAIL' ? 422 : 200;
      return send(res, statusCode, attestation);
    } catch (err) {
      return send(res, 400, { status: 'FAIL', error: err.message || 'Invalid evidence' });
    }
  }

  return false;
}

module.exports = { handle };
