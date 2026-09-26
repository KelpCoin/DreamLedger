'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const contract = require('../runtime/ActuatorReadyContract');

test('cell contract validates a complete world-ready cell', () => {
  const cell = contract.validateCell({
    cell_id: 'CELL-001', object: 'Commander Deck Diagnostic',
    buyer: { definition: 'NZ Commander players seeking deck diagnosis' }, demand: { signal: 'purchase_intent' },
    offer: { sku: 'CMD-DIAG-29', price_nzd: 29, currency: 'NZD' }, channel: { type: 'public_checkout' },
    world_surface: { world_url: 'https://dreamledger.org/buy/cmd-diag-29', transaction_url: 'https://dreamledger.org/buy/cmd-diag-29', verification: { ok: true, world: { ok: true }, transaction: { ok: true }, checked_at: '2026-09-26T00:00:00Z' } },
    fulfillment: { type: 'manual_digital_delivery' }, attribution: { required: true }, evidence: { required: true },
    verification_rules: { require_external_buyer: true, require_settlement: true, require_fulfillment: true, require_evidence: true },
    authority_requirements: { external_action: 'HUMAN_AUTHORITY' }, lifecycle_state: 'READY'
  });
  assert.equal(cell.ok, true);
  assert.equal(cell.lifecycle_state, 'READY');
});

test('a candidate without a URL cannot become world-ready', () => {
  const result = contract.validateWorldSurface({ transaction_url: 'https://dreamledger.org/buy/cmd-diag-29', verification: { ok: true, world: { ok: true }, transaction: { ok: true }, checked_at: '2026-09-26T00:00:00Z' } });
  assert.equal(result.status, 'NOT_WORLD_READY');
  assert.ok(result.missing.includes('world_url'));
});

test('an HTTP failure cannot become world-ready', () => {
  const result = contract.validateWorldSurface({ world_url: 'https://example.invalid', transaction_url: 'https://example.invalid', verification: { ok: false, world: { ok: false }, transaction: { ok: false }, checked_at: '2026-09-26T00:00:00Z' } });
  assert.equal(result.status, 'NOT_WORLD_READY');
  assert.ok(result.missing.includes('live_http_verification'));
});

test('business truth cannot verify without the full external chain', () => {
  const result = contract.evaluateBusinessTruth({ classification: 'OBSERVED', external_buyer: true, settled_transaction: true, attributed: true, fulfilled: false, evidence: ['e1'], external_reference: 'pi_live_001' });
  assert.equal(result.status, 'UNVERIFIED'); assert.deepEqual(result.missing, ['fulfillment']);
});

test('test-mode evidence can never become verified', () => {
  const result = contract.evaluateBusinessTruth({ classification: 'TEST', external_buyer: true, settled_transaction: true, attributed: true, fulfilled: true, evidence: ['e1'], external_reference: 'pi_test_001' });
  assert.equal(result.status, 'TEST'); assert.ok(result.missing.includes('live_external_event'));
});

test('authority preparation is deterministic and cannot execute', () => {
  const input = { action_type: 'SEND_OFFER', payload: { recipient: 'external', offer_id: 'CELL-001' }, expected_consequence: 'External outreach', reversible: false, credentials_required: ['human_session'], expires_at: '2099-01-01T00:00:00.000Z' };
  const a = contract.prepareAuthority(input), b = contract.prepareAuthority(input);
  assert.equal(a.state, 'PENDING_AUTHORITY'); assert.equal(a.execution_allowed, false); assert.equal(a.idempotency_key, b.idempotency_key);
});

test('unavailable actuator never fakes an effect', () => {
  const result = contract.executeWithActuator({ action_request: { action_id: 'a1', idempotency_key: 'k1' }, actuator: { status: 'ACTUATOR_UNAVAILABLE' } });
  assert.equal(result.state, 'EXTERNAL_ACTUATOR_UNAVAILABLE'); assert.equal(result.external_effect, null); assert.equal(result.external_reference, null);
});

test('replication requires two independent verified buyers', () => {
  assert.equal(contract.replicationStatus([{ status: 'VERIFIED', buyer_key: 'buyer-a' }]).state, 'VERIFIED_NOT_REPLICABLE');
  assert.equal(contract.replicationStatus([{ status: 'VERIFIED', buyer_key: 'buyer-a' }, { status: 'VERIFIED', buyer_key: 'buyer-b' }]).state, 'REPLICABLE');
});

test('invalid lifecycle transitions are rejected', () => { assert.throws(() => contract.assertTransition('READY', 'VERIFIED'), /INVALID_TRANSITION/); });


test('world-surface verifier performs a real HTTP check before readiness', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/ok') { res.writeHead(200, {'content-type':'text/plain'}); return res.end('ready'); }
    res.writeHead(500); res.end('failed');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    const ok = await contract.verifyWorldSurface('http://127.0.0.1:' + port + '/ok');
    const bad = await contract.verifyWorldSurface('http://127.0.0.1:' + port + '/bad');
    assert.equal(ok.ok, true);
    assert.equal(ok.http_status, 200);
    assert.equal(ok.final_url, 'http://127.0.0.1:' + port + '/ok');
    assert.equal(bad.ok, false);
    assert.equal(bad.http_status, 500);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('cell cannot be world-ready from a claimed HTTP status alone', () => {
  const result = contract.validateCell({
    cell_id:'CELL-FAKE', object:'x', buyer:{}, demand:{}, offer:{sku:'X',price_nzd:1},
    channel:{}, fulfillment:{}, attribution:{}, evidence:{}, verification_rules:{},
    authority_requirements:{}, lifecycle_state:'READY',
    world_surface:{world_url:'https://example.invalid',transaction_url:'https://example.invalid',http_status:200,checked_at:'2026-09-26T00:00:00Z'}
  });
  assert.equal(result.status, 'NOT_WORLD_READY');
});
