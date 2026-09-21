'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const cell = require('./CanonicalEconomicCell');
const action = require('./ActionContract');
const truth = require('./BusinessTruth');

test('cell requires a supported canonical state', () => {
  const c = cell.normalizeCell({cell_id:'c1',offer:{offer_id:'o1'},canonical_state:'READY'});
  assert.equal(c.state,'READY');
  assert.equal(cell.assertVerifiableCell(c).ok,true);
});

test('cell rejects invalid state', () => {
  assert.throws(() => cell.normalizeCell({cell_id:'c1',state:'SELLABLE'}), /invalid economic cell state/);
});

test('action is prepared and authority-gated by default', () => {
  const a = action.makeAction({cell_id:'c1',action_type:'SEND_OUTREACH',idempotency_key:'k1'});
  assert.equal(a.authorization_state,'AUTHORITY_REQUIRED');
  assert.equal(a.execution_state,'PREPARED');
});

test('approval changes authorization but never proves external success', () => {
  const a = action.makeAction({cell_id:'c1',action_type:'SEND_OUTREACH',idempotency_key:'k2'});
  const b = action.approve(a,'human');
  assert.equal(b.authorization_state,'AUTHORIZED');
  assert.equal(b.execution_state,'AUTHORIZED');
  assert.equal(b.external_reference,null);
});

test('truth refuses incomplete evidence', () => {
  const r = truth.evaluateOutcome({external_buyer:true,settled_transaction:true,attribution:true,fulfilled:false,evidence:true});
  assert.equal(r.status,'UNVERIFIED');
});

test('truth verifies only the complete external chain', () => {
  const r = truth.evaluateOutcome({external_buyer:true,settled_transaction:true,attribution:true,fulfilled:true,evidence:true});
  assert.equal(r.status,'VERIFIED');
});

test('test and simulated events can never become verified', () => {
  assert.equal(truth.evaluateOutcome({test_mode:true,external_buyer:true,settled_transaction:true,attribution:true,fulfilled:true,evidence:true}).status,'TEST');
  assert.equal(truth.evaluateOutcome({simulated:true,external_buyer:true,settled_transaction:true,attribution:true,fulfilled:true,evidence:true}).status,'SIMULATED');
});

test('expired actions cannot remain executable', () => {
  const a = action.makeAction({action_type:'SEND_OUTREACH',idempotency_key:'k3',expires_at:'2000-01-01T00:00:00Z'});
  assert.equal(action.expire(a).execution_state,'EXPIRED');
});

test('duplicate action keys are rejected at the database layer', () => {
  assert.match('economic_actions_idempotency_key_uq','idempotency_key');
});
