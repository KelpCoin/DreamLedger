#!/usr/bin/env node
'use strict';

/*
Hard gate for money-moving or external outreach actions.

Usage:
  node AssertAuthorizationRecord.js <authorization.json> <proposed.json>

The proposed action must match the immutable authorization snapshot exactly
for recipient, amount, currency, action type, offer, payment link and message.
The authorization must be explicitly APPROVED, unexpired, and internally
hash-consistent. A changed prospect row cannot silently inherit approval.
*/

const fs = require('fs');
const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function fail(message) {
  console.error(`AUTHORIZATION DENIED: ${message}`);
  process.exitCode = 2;
}

function read(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function canonicalSnapshot(snapshot) {
  return JSON.stringify(snapshot);
}

const authorizationPath = process.argv[2];
const proposedPath = process.argv[3];
if (!authorizationPath || !proposedPath) {
  fail('authorization and proposed action files are required');
} else {
  try {
    const auth = read(authorizationPath);
    const proposed = read(proposedPath);
    const snapshot = auth.immutable_snapshot;

    if (!snapshot || auth.schema_version !== 'BEC-AUTHORIZATION-1.0') throw new Error('invalid authorization schema');
    const recomputed = sha256(canonicalSnapshot(snapshot));
    if (recomputed !== auth.payload_hash) throw new Error('immutable snapshot hash mismatch');
    if (auth.approval_status !== 'APPROVED') throw new Error(`approval_status=${auth.approval_status || 'MISSING'}`);
    if (!auth.approved_by || !auth.approved_at) throw new Error('approved_by and approved_at are required');
    if (Date.parse(snapshot.expires_at) <= Date.now()) throw new Error('authorization expired');

    const fields = [
      ['action_type', snapshot.action_type, proposed.action_type],
      ['recipient', snapshot.recipient, proposed.recipient],
      ['amount', snapshot.amount, proposed.amount],
      ['currency', snapshot.currency, proposed.currency],
      ['offer_sku', snapshot.offer_sku, proposed.offer_sku],
      ['payment_link', snapshot.payment_link, proposed.payment_link],
      ['message_body', snapshot.message_body, proposed.message_body]
    ];
    for (const [name, expected, actual] of fields) {
      if (String(expected ?? '') !== String(actual ?? '')) throw new Error(`${name} changed after approval`);
    }

    if (sha256(snapshot.message_body) !== snapshot.message_hash) throw new Error('message hash mismatch');
    if (!snapshot.nonce || !/^[a-f0-9]{32}$/i.test(snapshot.nonce)) throw new Error('invalid nonce');

    console.log('AUTHORIZATION VERIFIED');
    console.log(`authorization_id=${auth.authorization_id}`);
    console.log(`approved_by=${auth.approved_by}`);
    console.log(`approved_at=${auth.approved_at}`);
    console.log(`recipient_hash=${snapshot.recipient_hash}`);
    console.log(`payload_hash=${auth.payload_hash}`);
  } catch (error) {
    fail(error && error.message ? error.message : String(error));
  }
}
