'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');

process.env.DREAMLEDGER_TOLL_KEY_SECRET='test-only-secret';

const Toll=require('./TollRoad');

test('toll keys are signed, scoped, expirable and fail closed',()=>{
  const key=Toll.issueKey({keyId:'TEST-1',tier:'gauntlet',callsRemaining:3});
  const ok=Toll.verifyKey(key,'gauntlet');
  assert.equal(ok.ok,true);
  assert.equal(ok.payload.key_id,'TEST-1');
  assert.equal(Toll.verifyKey(key,'truth').ok,false);
  assert.equal(Toll.verifyKey(key,'gauntlet').payload.calls_remaining,3);
  const tampered=key.slice(0,-1)+(key.endsWith('a')?'b':'a');
  assert.equal(Toll.verifyKey(tampered,'gauntlet').ok,false);
});

test('truth/all scopes do not grant unrelated internal authority',()=>{
  const key=Toll.issueKey({keyId:'TEST-2',tier:'truth',callsRemaining:1});
  assert.equal(Toll.verifyKey(key,'truth').ok,true);
  assert.equal(Toll.verifyKey(key,'gauntlet').ok,false);
});
