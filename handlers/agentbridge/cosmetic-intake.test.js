'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const handler=require('./cosmetic-intake');
test('creator endpoint refuses uncredentialed requests',async()=>{
 const request=new Request('https://dreamledger.org/api/agent-bridge/cosmetics/submit',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
 const r=await handler(request);
 assert.equal(r.status,401);
 assert.equal((await r.json()).error,'CREATOR_AUTH_REQUIRED');
});
test('a shared machine Agent Bridge token cannot replace Peggy creator credential',async()=>{
 const request=new Request('https://dreamledger.org/api/agent-bridge/cosmetics/mine',{headers:{'x-dreamledger-agent-token':'shared-machine-credential'}});
 assert.equal((await handler(request)).status,401);
});
test('authenticated endpoint requires properly provisioned Neon primary',async()=>{
 const token='peg_private_secret_synthetic_6e0bdb8c70b63863832';
 const oldHash=process.env.BECK_CREATOR_PEGGY_TOKEN_SHA256;
 const oldDB=process.env.BECK_NEON_CREATOR_DATABASE_URL;
 try{
   process.env.BECK_CREATOR_PEGGY_TOKEN_SHA256=crypto.createHash('sha256').update(token).digest('hex');
   delete process.env.BECK_NEON_CREATOR_DATABASE_URL;
   const request=new Request('https://dreamledger.org/api/agent-bridge/cosmetics/mine',{headers:{authorization:'Bearer '+token}});
   const response=await handler(request);
   assert.equal(response.status,503);
   assert.equal((await response.json()).error,'NEON_CREATOR_PRIMARY_NOT_CONFIGURED');
 }finally{
   if(oldHash===undefined)delete process.env.BECK_CREATOR_PEGGY_TOKEN_SHA256;else process.env.BECK_CREATOR_PEGGY_TOKEN_SHA256=oldHash;
   if(oldDB===undefined)delete process.env.BECK_NEON_CREATOR_DATABASE_URL;else process.env.BECK_NEON_CREATOR_DATABASE_URL=oldDB;
 }
});
test('foreign origin denied before any database',async()=>{
 const request=new Request('https://dreamledger.org/api/agent-bridge/cosmetics/mine',{headers:{origin:'https://external.example'}});
 const r=await handler(request);
 assert.equal(r.status,403);
 assert.equal((await r.json()).error,'UNTRUSTED_ORIGIN');
});
