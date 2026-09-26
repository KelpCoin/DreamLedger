'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const {canonical,sha256,materialIntent,assertTicketBinding}=require('./ExecutionGate');
test('canonicalization is deterministic',()=>{assert.equal(canonical({b:2,a:1}),canonical({a:1,b:2}));assert.equal(sha256({b:2,a:1}),sha256({a:1,b:2}));});
test('payload binding rejects drift',()=>{const t={tool_name:'test.tool',arguments:{target:'A',amount:10},target:'A',amount_nzd:10,agent_identity:'agent:test',policy_version:'v1'};t.payload_hash=sha256(materialIntent(t));assert.doesNotThrow(()=>assertTicketBinding(t,materialIntent(t)));assert.throws(()=>assertTicketBinding(t,{...materialIntent(t),arguments:{target:'B',amount:10}}),/TICKET_PAYLOAD_BINDING_INVALID/);});
test('forged hash is rejected',()=>{const t={tool_name:'test',arguments:{x:1},target:null,amount_nzd:null,agent_identity:'a',policy_version:'v1',payload_hash:'deadbeef'};assert.throws(()=>assertTicketBinding(t,materialIntent(t)),/TICKET_PAYLOAD_BINDING_INVALID/);});
