'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const p=require('./mtgTradePassport.js');
function fresh(){return p.fresh({seller_handle:'KiwiDragons',seller_offers:'Sol Ring NM',seller_wants:'Arcane Signet LP',terms:'NZ tracked shipping each direction'});}
test('guest trade begins without legal name, account, money or public posting',()=>{
 const {record,seller_token,invitation_token}=fresh();
 assert.equal(record.fee_nzd,0);
 assert.equal(record.verification,'PEER_ATTESTED_ONLY');
 assert(!JSON.stringify(record).includes(seller_token));
 assert(!JSON.stringify(record).includes(invitation_token));
 assert.equal(p.verifyChain(record),true);
 assert.equal(p.view(record,'seller',seller_token).government_name,null);
});
test('counterparty can join with invite and confirm an agreed trade',()=>{
 const x=fresh();
 const y=p.join(x.record,x.invitation_token,'CommanderFan');
 assert.equal(x.record.status,'AWAITING_AGREEMENT');
 assert.throws(()=>p.join(x.record,x.invitation_token,'alt'),/COUNTERPARTY_ALREADY_JOINED/);
 p.agree(x.record,'seller',x.seller_token);
 p.agree(x.record,'buyer',y.buyer_token);
 assert.equal(x.record.status,'AGREED');
 p.done(x.record,'seller',x.seller_token);
 assert.equal(x.record.status,'AWAITING_COMPLETION');
 p.done(x.record,'buyer',y.buyer_token);
 assert.equal(x.record.status,'PEER_REPORTED_COMPLETE');
 assert.equal(p.view(x.record,'buyer',y.buyer_token).reputation_credit,0);
});
test('feedback is private until both roles leave one review each',()=>{
 const x=fresh(),y=p.join(x.record,x.invitation_token,'other');
 p.agree(x.record,'seller',x.seller_token);p.agree(x.record,'buyer',y.buyer_token);
 p.done(x.record,'seller',x.seller_token);p.done(x.record,'buyer',y.buyer_token);
 p.feedback(x.record,'buyer',y.buyer_token,'positive','Cards matched agreed condition');
 assert.equal(p.view(x.record,'seller',x.seller_token).feedback.buyer,undefined);
 p.feedback(x.record,'seller',x.seller_token,'neutral','Everything completed');
 assert.equal(p.view(x.record,'seller',x.seller_token).feedback.buyer.rating,'positive');
 assert.throws(()=>p.feedback(x.record,'seller',x.seller_token,'positive','again'),/ONE_FEEDBACK_PER_SIDE/);
});
test('no self-reviews or ratings from only one party',()=>{
 const x=fresh();
 assert.throws(()=>p.join(x.record,x.invitation_token,'kiwidragons'),/DISTINCT_TRADING_HANDLES/);
 assert.throws(()=>p.feedback(x.record,'seller',x.seller_token,'positive','excellent'),/BOTH_PARTIES/);
});
test('secrets, tampering, replay and PII-like feedback are rejected',()=>{
 const x=fresh(),y=p.join(x.record,x.invitation_token,'buyer');
 assert.throws(()=>p.agree(x.record,'buyer',x.seller_token),/INVALID_ROLE_CAPABILITY/);
 const altered=structuredClone(x.record);altered.events[0].detail.seller_handle='FAKE';
 assert.equal(p.verifyChain(altered),false);
 p.agree(x.record,'seller',x.seller_token);
 assert.throws(()=>p.agree(x.record,'seller',x.seller_token),/ALREADY_AGREED/);
 p.agree(x.record,'buyer',y.buyer_token);
 p.done(x.record,'seller',x.seller_token);p.done(x.record,'buyer',y.buyer_token);
 assert.throws(()=>p.feedback(x.record,'buyer',y.buyer_token,'positive','Phone 02112345678'),/CONTACT_DETAILS/);
});
