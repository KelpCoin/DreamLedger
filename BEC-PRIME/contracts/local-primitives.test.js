'use strict';

const assert = require('assert');
const crypto = require('crypto');
const p = require('./local-primitives');

function testTopology() {
  const node = p.makeTopologyNode({
    node_id:'node.proposer',
    capability:'proposal',
    model_ref:'LOCAL_MODEL',
    proficiency:{reliability:.8, task_fit:.9, sample_count:12}
  });
  const edge = p.makeTopologyEdge({from:'node.proposer',to:'node.critic',topic:'candidate',weight:.75});
  const task = p.makeTaskEnvelope({task_id:'T-1',objective:'refine one candidate',requested_capability:'proposal'});
  assert.equal(node.proficiency.reliability,.8);
  assert.equal(edge.topic,'candidate');
  assert.equal(task.authorization,'LOCAL_ONLY');
  assert.equal(task.external_effect,false);
}

function testEconomicEvent() {
  const event = p.makeEconomicEvent({
    event_id:'E-1',
    event_type:'payment.observed',
    rail:'MANUAL',
    economic_status:'SIMULATED',
    amount:5000,
    currency:'NZD'
  });
  assert.equal(event.schema_version,'DL-EVENT-1.0');
  assert.equal(event.economic_status,'SIMULATED');
  assert.equal(event.rail,'MANUAL');
}

function testEd25519() {
  const keys = crypto.generateKeyPairSync('ed25519');
  const payload = {placement_id:'fixture-1', played_at:'2026-09-22T00:00:00Z', proof:'FIXTURE_ONLY'};
  const attestation = p.signObservation(payload, keys.privateKey);
  assert.equal(attestation.algorithm,'Ed25519');
  assert.equal(p.verifyObservation(attestation, keys.publicKey),true);
  const tampered = {...attestation, payload:{...payload, proof:'TAMPERED'}};
  assert.equal(p.verifyObservation(tampered, keys.publicKey),false);
}

function testPublicSurface() {
  const record = p.makePublicSurfaceRecord({
    subject_id:'truth-1',
    status:'UNVERIFIED',
    access_tier:'PAID',
    claim:'Example sanitized claim'
  });
  assert.equal(record.sanitized,true);
  assert.equal(record.contains_secrets,false);
  assert.equal(record.live_deployment_verified,false);
}

function testRailAdapter() {
  const adapter = p.makeHealthContract({
    adapter_id:'ACP',
    status:'ADAPTER_READY',
    live_verification:false,
    credentials_required:true,
    fixture:'fixtures/acp-event.json'
  });
  assert.equal(adapter.status,'ADAPTER_READY');
  assert.equal(adapter.live_verification,false);
}

function testAlignment() {
  const result = p.economicAlignment({
    stability:1, integrity:.8, welfare:.7, profitability:.6, reusability:.9
  });
  assert(Math.abs(result.score - .8) < 1e-9);
  assert.equal(result.advisory_only,true);
}

[
  testTopology,
  testEconomicEvent,
  testEd25519,
  testPublicSurface,
  testRailAdapter,
  testAlignment
].forEach(fn => fn());

console.log(JSON.stringify({
  status:'PASS',
  suite:'local-primitives',
  tests:6,
  live_economic_proof:'NONE',
  note:'All results are local deterministic engineering evidence only.'
}, null, 2));
