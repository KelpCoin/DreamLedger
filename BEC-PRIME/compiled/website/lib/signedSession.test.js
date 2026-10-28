'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {sign,verify,fromCookie,MAX_AGE_SECONDS}=require('./signedSession.js');
const secret='synthetic-secret-32-characters-minimum-ABC123456789';
const id='u_0123456789abcdef01234567';
test('signed session authenticates account and is usable by cookie reader',()=>{
 const t=sign(id,secret,1700000000);
 assert.equal(verify(t,secret,1700000001),id);
 assert.equal(fromCookie('other=a; dreamiez_session='+encodeURIComponent(sign(id,secret)),secret),id);
});
test('legacy unsigned account-id cookie fails closed',()=>{
 assert.equal(fromCookie('dreamiez_session='+id,secret),null);
});
test('invalid or tampered session cannot impersonate account',()=>{
 const t=sign(id,secret,1700000000);
 assert.equal(verify(t.slice(0,-1)+(t.endsWith('0')?'1':'0'),secret,1700000001),null);
 assert.equal(verify(t,'synthetic-different-secret-longer-than-32-characters',1700000001),null);
});
test('expired session and future iat are rejected',()=>{
 const t=sign(id,secret,1700000000);
 assert.equal(verify(t,secret,1700000000+MAX_AGE_SECONDS),null);
 assert.equal(verify(sign(id,secret,1700001000),secret,1700000000),null);
});
test('short or unavailable secret cannot sign or verify',()=>{
 assert.throws(()=>sign(id,'short'),/SECURE_SESSION_UNAVAILABLE/);
 assert.equal(verify(sign(id,secret,1700000000),'short',1700000001),null);
});
test('malformed or oversized token rejected',()=>{
 assert.equal(verify('v1.bad.bad',secret),null);
 assert.equal(verify('x'.repeat(1600),secret),null);
});
