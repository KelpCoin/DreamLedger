'use strict';
// BECK physical DOOH media boundary. Provider-neutral, deterministic and offline.
// Screen inventory is NEVER derived from the internet billboard or a sandbox.
// A physical inventory record requires explicit third-party ownership evidence.
// This is a planner and evidence verifier, NOT a booking/spend/payout executor.
const crypto=require('node:crypto');
const REGIONS=new Set(['NZ','AU','ZA','GB','US','GLOBAL','EUROPE','AMERICAS']);
const HEX=/^[0-9a-f]{64}$/i;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,99}$/;
function verdict(accept,reason,other={}) {return {eligible:Boolean(accept),reason,...other};}
function verifyInventory(screen,now=new Date()) {
 if(!screen||typeof screen!=='object'||Array.isArray(screen)) return verdict(false,'INVALID_SCREEN');
 if(!ID.test(String(screen.screen_id||'')))return verdict(false,'SCREEN_ID_REQUIRED');
 const region=String(screen.region||'').toUpperCase();
 if(!REGIONS.has(region))return verdict(false,'REGION_NOT_SUPPORTED');
 if(!ID.test(String(screen.publisher_id||'')))return verdict(false,'PUBLISHER_ID_REQUIRED');
 if(!ID.test(String(screen.partner_authorization_id||'')))return verdict(false,'PUBLISHER_AUTHORIZATION_REQUIRED');
 if(String(screen.status)!=='VERIFIED_AVAILABLE')return verdict(false,'NOT_VERIFIED_AVAILABLE');
 if(!HEX.test(String(screen.inventory_receipt_sha256||'')))return verdict(false,'INVENTORY_RECEIPT_REQUIRED');
 const verified=Date.parse(String(screen.verified_at||''));
 const expires=Date.parse(String(screen.expires_at||''));
 const time=now instanceof Date?now.valueOf():Number(now);
 if(!Number.isFinite(verified)||!Number.isFinite(expires)||!Number.isFinite(time))
  return verdict(false,'INVALID_VERIFICATION_TIME');
 if(verified>time+300000||expires<=time||expires<=verified)
  return verdict(false,'STALE_OR_FUTURE_INVENTORY_PROOF');
 if(time-verified>86400000)return verdict(false,'VERIFICATION_TOO_OLD');
 if(!Number.isInteger(screen.width_px)||!Number.isInteger(screen.height_px)||
    screen.width_px<128||screen.height_px<128)return verdict(false,'SCREEN_DIMENSIONS_REQUIRED');
 if(!Number.isFinite(screen.min_duration_ms)||screen.min_duration_ms<=0)
  return verdict(false,'SCREEN_DURATION_REQUIRED');
 return verdict(true,'PROVIDER_EVIDENCE_REQUIRED_FOR_BOOKING',{region,screen_id:screen.screen_id});
}
function planCampaign({region,budget_minor,creative_sha256,duration_ms,approved_creative,inventory},now=new Date()) {
 if(!REGIONS.has(String(region||'').toUpperCase()))return {status:'HOLD',reason:'INVALID_REGION',eligible_screens:[]};
 if(!Number.isSafeInteger(budget_minor)||budget_minor<0)return {status:'HOLD',reason:'INVALID_BUDGET',eligible_screens:[]};
 if(!HEX.test(String(creative_sha256||''))||approved_creative!==true)
  return {status:'HOLD',reason:'UNAPPROVED_CREATIVE',eligible_screens:[]};
 if(!Number.isInteger(duration_ms)||duration_ms<1000||duration_ms>120000)
  return {status:'HOLD',reason:'INVALID_DURATION',eligible_screens:[]};
 const matches=[];
 for(const item of Array.isArray(inventory)?inventory:[]){
  if(String(item?.region||'').toUpperCase()!==String(region).toUpperCase())continue;
  const v=verifyInventory(item,now);
  if(v.eligible&&Number(item.min_duration_ms)<=duration_ms)matches.push(String(item.screen_id));
 }
 return {status:matches.length?'REVIEW_REQUIRED':'HOLD',
  reason:matches.length?'PHYSICAL_INVENTORY_CANDIDATES_NOT_BOOKED':'NO_VERIFIED_PHYSICAL_INVENTORY',
  eligible_screens:matches,budget_minor,creative_sha256,duration_ms,
  booking_created:false,spend_authorized:false,impressions_verified:0};
}
function payloadProof(p) {
 if(!p||typeof p!=='object'||Array.isArray(p))return null;
 for(const key of ['proof_id','campaign_id','screen_id','publisher_id']){
  if(!ID.test(String(p[key]||'')))return null;
 }
 const t=Date.parse(String(p.played_at||''));
 if(!Number.isFinite(t)||!Number.isSafeInteger(p.duration_ms)||p.duration_ms<1000||
    !HEX.test(String(p.creative_sha256||'')))return null;
 return [p.proof_id,p.campaign_id,p.screen_id,p.publisher_id,
   new Date(t).toISOString(),p.duration_ms,p.creative_sha256.toLowerCase()].join('\n');
}
function verifyPlaybackProof({proof,public_key_pem,authorized_publisher_id,authorized_screens,now=new Date()}) {
 const message=payloadProof(proof);
 if(!message)return {verified:false,reason:'MALFORMED_PROOF'};
 if(proof.publisher_id!==authorized_publisher_id||
    !Array.isArray(authorized_screens)||!authorized_screens.includes(proof.screen_id))
  return {verified:false,reason:'SCREEN_OR_PUBLISHER_NOT_AUTHORIZED'};
 const played=Date.parse(proof.played_at),time=now.valueOf();
 if(!Number.isFinite(time)||played>time+300000||time-played>86400000)
  return {verified:false,reason:'PROOF_OUT_OF_WINDOW'};
 try {
  const key=crypto.createPublicKey(public_key_pem);
  if(key.asymmetricKeyType!=='ed25519')return {verified:false,reason:'UNSUPPORTED_SIGNER'};
  const signature=Buffer.from(String(proof.signature_base64||''),'base64');
  if(!signature.length||signature.toString('base64')!==proof.signature_base64)
   return {verified:false,reason:'MALFORMED_SIGNATURE'};
  if(!crypto.verify(null,Buffer.from(message),key,signature))
   return {verified:false,reason:'INVALID_SIGNATURE'};
  return {verified:true,reason:'SIGNED_PROOF_ACCEPTED_FOR_RECONCILIATION',
   proof_id:proof.proof_id,screen_id:proof.screen_id,creative_sha256:proof.creative_sha256,
   note:'Signed playback evidence still requires durable proof_id deduplication and independent provider reconciliation before any billable impression claim.'};
 }catch{return {verified:false,reason:'SIGNER_UNVERIFIABLE'};}
}
module.exports={verifyInventory,planCampaign,verifyPlaybackProof,payloadProof};
