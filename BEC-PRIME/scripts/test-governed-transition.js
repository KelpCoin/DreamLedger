'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs');
const os = require('os');
const path = require('path');

test('governed transition rejects unauthorized external action and records it idempotently', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-governed-'));
  process.env.BEC_LEDGER_DIR = dir;
  delete require.cache[require.resolve('../runtime/Ledger')];
  delete require.cache[require.resolve('../runtime/GovernedTransition')];
  const ledger = require('../runtime/Ledger');
  const { executeTransition } = require('../runtime/GovernedTransition');
  const input = { transition_id:'test-governed-1', transition_name:'OFFER_TO_EXTERNAL_PUBLISH', entity_id:'offer-test', idempotency_key:'idem-test-1', schema_version:'1.0', requested_by:'test', requested_action:'publish', evidence:{}, blast_radius:{max_spend_nzd:0,max_recipients:1,max_external_actions:1} };
  const first = executeTransition(input, { garage_status:'READY_FOR_PROMOTION' });
  const second = executeTransition(input, { garage_status:'READY_FOR_PROMOTION' });
  assert.equal(first.decision, 'REJECT');
  assert.equal(second.decision, 'REJECT');
  assert.equal(first.ledger_event.event_id, second.ledger_event.event_id);
  assert.equal(second.idempotent, true);
  assert.equal(ledger.verifyChain().status, 'PASS');
});
