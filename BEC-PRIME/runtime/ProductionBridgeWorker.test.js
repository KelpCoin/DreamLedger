'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {isInfrastructureFailure,nextDelayMs}=require('./ProductionBridgeWorker');

test('classifies Supabase proxy timeout and resource failures as infrastructure failures',()=>{
  assert.equal(isInfrastructureFailure(Object.assign(new Error('Supabase rail proxy failed (504) :: idle timeout'),{statusCode:504})),true);
  assert.equal(isInfrastructureFailure(Object.assign(new Error('Function failed due to not having enough compute resources'),{statusCode:546})),true);
  assert.equal(isInfrastructureFailure(new Error('job validation failed')),false);
});

test('exponential infrastructure backoff caps at 15 minutes and resets after recovery',()=>{
  assert.equal(nextDelayMs(false),60000);
  assert.equal(nextDelayMs(true),60000);
  assert.equal(nextDelayMs(true),120000);
  assert.equal(nextDelayMs(true),240000);
  assert.equal(nextDelayMs(true),480000);
  assert.equal(nextDelayMs(true),900000);
  assert.equal(nextDelayMs(true),900000);
  assert.equal(nextDelayMs(false),60000);
});
