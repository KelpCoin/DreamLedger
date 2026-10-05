'use strict';
const assert=require('assert');
const {runNexus}=require('./TollNexus');
const out=runNexus({
  evidence_state:{evidence:[{source:'test'}],contradictions:[],unresolved:[]},
  candidate:{candidate_id:'TEST-NEXUS',status:'CANDIDATE'},
  agent_id:'test-agent',
  room_id:'ROOM-TEST',
  note:'test'
},{key_id:'TEST-KEY'});
assert.strictEqual(out.schema,'dreamledger/toll-nexus/v1');
assert.strictEqual(out.product,'TOLL_NEXUS');
assert.ok(Array.isArray(out.bundle_surfaces));
assert.ok(out.bundle_surfaces.includes('agent-passport'));
assert.ok(out.bundle_surfaces.includes('multi-agent-room'));
assert.ok(out.bundle_surfaces.includes('capacity-futures'));
assert.strictEqual(out.economic_truth_unchanged,true);
console.log('Toll Nexus test PASS');
