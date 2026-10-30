'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {test}=require('node:test');
const {draftFromBody,authorize,verifyOrigin}=require('./cosmetic-policy');
const make=(overrides={})=>{
 const image=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(40,0)]);
 return {title:'Peggy Ink Wings',slot:'back',filename:'ink-wings.png',
   mime:'image/png',base64:image.toString('base64'),
   artist_credit:'Peggy',rights_confirmed:true,...overrides};
};
test('PNG is private, avatar only and sale blocked',()=>{
 const v=draftFromBody(make(),'peggy');
 assert.match(v.draftId,/^ASSET-PEGGY-[A-F0-9]{20}$/);
 assert.equal(v.creatorId,'peggy');assert.equal(v.siloId,'SILO_AVATAR');
 assert.equal(v.status,'DRAFT');assert.equal(v.checkout_available,false);
 assert.equal(v.approval_required,true);assert.equal(v.bytes,48);
});
test('idempotent identifiers derived from source bytes',()=>{
 const a=draftFromBody(make(),'peggy'),b=draftFromBody(make(),'peggy');
 assert.equal(a.draftId,b.draftId);
 assert.equal(a.metaHash,b.metaHash);
});
test('different title on same image changes metadata hash, not canonical asset id',()=>{
 const a=draftFromBody(make(),'peggy'),b=draftFromBody(make({title:'Another name'}),'peggy');
 assert.equal(a.draftId,b.draftId);
 assert.notEqual(a.metaHash,b.metaHash);
});
test('must confirm art rights',()=>{
 assert.throws(()=>draftFromBody(make({rights_confirmed:false}),'peggy'),/ARTWORK_RIGHTS_REQUIRED/);
});
test('cannot inject public price, adult silo, or approval status',()=>{
 for(const k of ['silo_id','creator_id','status','checkout_available','price_minor','gauntlet_status','published_at']){
   assert.throws(()=>draftFromBody(make({[k]:'evil'}),'peggy'),/FORBIDDEN_CREATOR_FIELD/);
 }
});
test('rejects SVG or wrong MIME despite browser claim',()=>{
 const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
 assert.throws(()=>draftFromBody(make({base64:svg.toString('base64'),mime:'image/png'}),'peggy'),/IMAGE_MAGIC_OR_MIME_REFUSED/);
});
test('rejects oversize or malformed base64',()=>{
 const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(1200100)]);
 assert.throws(()=>draftFromBody(make({base64:png.toString('base64')}),'peggy'),/INVALID_IMAGE_BASE64|IMAGE_SIZE_OR_ENCODING_REFUSED/);
 assert.throws(()=>draftFromBody(make({base64:'@/invalid'}),'peggy'),/INVALID_IMAGE_BASE64/);
});
test('rejects traversal filenames and invalid slots',()=>{
 assert.throws(()=>draftFromBody(make({filename:'../../x.png'}),'peggy'),/INVALID_FILENAME/);
 assert.throws(()=>draftFromBody(make({slot:'../../' }),'peggy'),/INVALID_SLOT/);
});
test('creator token is strong, separate and timing safe',()=>{
 const token='PeggyPrivateCreatorTokenThisShouldBeGeneratedSecurelyInSecrets';
 const env={BECK_CREATOR_PEGGY_TOKEN_SHA256:crypto.createHash('sha256').update(token).digest('hex')};
 const headers=new Headers({authorization:'Bearer '+token});
 assert.equal(authorize(headers,env),'peggy');
 assert.throws(()=>authorize(new Headers({authorization:'Bearer wrong'}),env),/CREATOR_AUTH_REQUIRED|CREATOR_AUTH_REFUSED/);
 assert.throws(()=>authorize(headers,{}),/CREATOR_AUTH_REQUIRED|CREATOR_AUTH_REFUSED/);
});
test('browser origin must be explicit allowlisted host',()=>{
 const allowed=new Headers({origin:'https://dreamledger.org'});
 verifyOrigin(allowed,{});
 assert.throws(()=>verifyOrigin(new Headers({origin:'https://malicious.example'}),{}),/UNTRUSTED_ORIGIN/);
});

test('both creators use distinct source IDs and private ownership',()=>{
 const peg=draftFromBody(make(),'peggy');
 const big=draftFromBody(make({artist_credit:'Biggie'}),'biggie');
 assert.match(big.draftId,/^ASSET-BIGGIE-[A-F0-9]{20}$/);
 assert.equal(big.creatorId,'biggie');
 assert.notEqual(big.draftId,peg.draftId);
 assert.notEqual(big.metaHash,peg.metaHash);
 assert.equal(big.siloId,'SILO_AVATAR');
 assert.equal(big.checkout_available,false);
 assert.throws(()=>draftFromBody(make(),'outsider'),/CREATOR_AUTH_REQUIRED/);
 assert.throws(()=>draftFromBody(make()),/CREATOR_AUTH_REQUIRED/);
});
test('either owner authenticates using independent digest, shared token cannot impersonate',()=>{
 const pegToken='PeggyPrivateCreatorTokenThisShouldBeGeneratedSecurelyInSecrets';
 const bigToken='BiggieIndependentCreatorTokenThatIsNotSharedWithOthers';
 const env={
  BECK_CREATOR_PEGGY_TOKEN_SHA256:crypto.createHash('sha256').update(pegToken).digest('hex'),
  BECK_CREATOR_BIGGIE_TOKEN_SHA256:crypto.createHash('sha256').update(bigToken).digest('hex')
 };
 assert.equal(authorize(new Headers({authorization:'Bearer '+pegToken}),env),'peggy');
 assert.equal(authorize(new Headers({authorization:'Bearer '+bigToken}),env),'biggie');
 assert.throws(()=>authorize(new Headers({authorization:'Bearer '+'z'.repeat(48)}),env),/CREATOR_AUTH_REFUSED/);
 const collision={...env,BECK_CREATOR_BIGGIE_TOKEN_SHA256:env.BECK_CREATOR_PEGGY_TOKEN_SHA256};
 assert.throws(()=>authorize(new Headers({authorization:'Bearer '+pegToken}),collision),/CREATOR_AUTH_REFUSED/);
});

test('AI-enhanced cosmetic requires same-owner original reference and never becomes a purchase',()=>{
  const original=draftFromBody(make(),'peggy');
  const enhanced=draftFromBody(make({title:'AI-enhanced Wings',
    origin_kind:'ai_enhanced',parent_draft_id:original.draftId}),'peggy');
  assert.equal(original.originKind,'hand_drawn');
  assert.equal(original.parentDraftId,null);
  assert.equal(enhanced.originKind,'ai_enhanced');
  assert.equal(enhanced.parentDraftId,original.draftId);
  assert.equal(enhanced.approval_required,true);
  assert.equal(enhanced.checkout_available,false);
  assert.notEqual(enhanced.metaHash,original.metaHash);
  assert.throws(()=>draftFromBody(make({origin_kind:'ai_enhanced'}),'peggy'),/PARENT_ORIGINAL_REQUIRED/);
  assert.throws(()=>draftFromBody(make({origin_kind:'ai_enhanced',parent_draft_id:original.draftId}),'biggie'),/PARENT_ORIGINAL_REQUIRED/);
  assert.throws(()=>draftFromBody(make({origin_kind:'hand_drawn',parent_draft_id:original.draftId}),'peggy'),/ORIGINAL_CANNOT_HAVE_PARENT/);
  assert.throws(()=>draftFromBody(make({origin_kind:'verified_ai_model',parent_draft_id:original.draftId}),'peggy'),/INVALID_ORIGIN_KIND/);
});
