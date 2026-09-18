'use strict';
const assert=require('assert/strict');
const defense=require('../security/AgentBridgeDefense');

assert.equal(defense.securityManifest().irreversible_default,false);
assert.equal(defense.validateActionBoundary({
  event_type:'ACTION_APPROVED',agent:'claude',lane:'approval',correlation_id:'c'
}).allowed,false);
assert.match(defense.validateActionBoundary({
  event_type:'ACTION_APPROVED',agent:'claude',lane:'approval',correlation_id:'c'
}).errors.join(';'),/human\/system/);
assert.equal(defense.validateActionBoundary({
  event_type:'ACTION_APPROVED',agent:'human',lane:'approval',correlation_id:'c'
}).allowed,true);
assert.equal(defense.validateActionBoundary({
  event_type:'ACTION_EXECUTED',agent:'system',lane:'execution',correlation_id:'c',subject_id:'s',evidence:[{id:'e1'}]
}).allowed,true);
assert.equal(defense.validateActionBoundary({
  event_type:'ACTION_EXECUTED',agent:'system',lane:'execution',correlation_id:'c',subject_id:'s'
}).allowed,false);
assert.equal(defense.validateActionBoundary({
  event_type:'PAYMENT_DETECTED',agent:'system',lane:'discovery',correlation_id:'c'
}).allowed,false);
assert.equal(defense.validateNoteBoundary({
  note_type:'STRUCTURED_EVENT',body:'x'
}).allowed,false);
const fp=defense.requestFingerprint({agent:'system',path:'/api/agent-bridge/events',correlationId:'c',body:{x:1}});
assert.equal(fp.length,64);
console.log(JSON.stringify({schema:'BEC-DEFENSIVE-CONTROL-PLANE-VERIFY/v1',status:'PASS'}));