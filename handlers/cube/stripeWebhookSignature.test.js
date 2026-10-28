'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {verifyStripeSignature:verify}=require('./stripeWebhookSignature.js');
const secret='synthetic-test-webhook-secret-with-length';
const payload=Buffer.from(JSON.stringify({id:'evt_synthetic',type:'checkout.session.completed'}));
const now=1793214000000,ts=Math.floor(now/1000);
function signed(buf=payload,t=ts){
 const h=createHmac('sha256',secret).update(String(t)).update('.').update(buf).digest('hex');
 return 't='+t+',v1='+h;
}
test('correct exact bytes and timestamp accepted',()=>{
 assert.equal(verify(payload,signed(),secret,now),true);
});
test('tampered JSON after signing rejected',()=>{
 assert.equal(verify(Buffer.concat([payload,Buffer.from(' ')]),signed(),secret,now),false);
});
test('changed signer secret rejected',()=>{
 assert.equal(verify(payload,signed(),'synthetic-different-test-secret',now),false);
});
test('outside Stripe five-minute tolerance rejected',()=>{
 assert.equal(verify(payload,signed(payload,ts-301),secret,now),false);
 assert.equal(verify(payload,signed(payload,ts+301),secret,now),false);
});
test('duplicate timestamp fields rejected',()=>{
 assert.equal(verify(payload,signed()+',t='+ts,secret,now),false);
});
test('malformed hex and oversized signature header rejected',()=>{
 assert.equal(verify(payload,'t='+ts+',v1=nothex',secret,now),false);
 assert.equal(verify(payload,'x'.repeat(9000),secret,now),false);
});
test('multiple signatures can include one matching candidate',()=>{
 assert.equal(verify(payload,'t='+ts+',v1='+'0'.repeat(64)+','+signed().split(',')[1],secret,now),true);
});
test('missing headers, non-buffer body, or weak secret rejected',()=>{
 assert.equal(verify(payload,'',secret,now),false);
 assert.equal(verify('not-buffer',signed(),secret,now),false);
 assert.equal(verify(payload,signed(),'weak',now),false);
});
