'use strict';
// Private BECK avatar creator draft policy. No payment, entitlement or publication.
// Original artwork and AI-assisted derivatives are kept in SILO_AVATAR.
// Both owners have independent credentials and private asset namespaces.
const crypto=require('node:crypto');
const LIMIT=1200000;
const SLOTS=new Set(['head','hair','face','neck','body','hands','back','feet','accessory']);
const CREATORS=new Set(['peggy','biggie']);
const ALLOWED_KEYS=new Set([
 'title','slot','filename','mime','base64','artist_credit','rights_confirmed',
 'notes','origin_kind','parent_draft_id'
]);
function refused(reason,status=400){
 const error=new Error(reason);error.status=status;throw error;
}
function sha256(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function authorize(headers,env){
 const header=String(headers.get('authorization')||'');
 const match=/^Bearer ([\w.~+/-]{32,256})$/.exec(header);
 if(!match)refused('CREATOR_AUTH_REQUIRED',401);
 const actual=Buffer.from(sha256(Buffer.from(match[1],'utf8')),'hex');
 const matches=[];
 for(const creator of CREATORS){
  const name='BECK_CREATOR_'+creator.toUpperCase()+'_TOKEN_SHA256';
  const expected=String(env[name]||'').trim().toLowerCase();
  if(!/^[0-9a-f]{64}$/.test(expected))continue;
  if(crypto.timingSafeEqual(Buffer.from(expected,'hex'),actual))matches.push(creator);
 }
 if(matches.length!==1)refused('CREATOR_AUTH_REFUSED',401);
 return matches[0];
}
function verifyOrigin(headers,env){
 const origin=headers.get('origin');
 if(!origin)return;
 const allowed=String(env.BECK_CREATOR_ALLOWED_ORIGINS||
 'https://dreamledger.org,https://www.dreamledger.org').split(',').map(x=>x.trim());
 if(!allowed.includes(origin))refused('UNTRUSTED_ORIGIN',403);
}
function mediaType(buffer,mime){
 const png=buffer.length>20&&buffer.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
 const jpeg=buffer.length>20&&buffer.subarray(0,3).equals(Buffer.from('ffd8ff','hex'))
  &&buffer.subarray(-2).equals(Buffer.from('ffd9','hex'));
 const webp=buffer.length>20&&buffer.subarray(0,4).toString('ascii')==='RIFF'
  &&buffer.subarray(8,12).toString('ascii')==='WEBP';
 const actual=png?'image/png':jpeg?'image/jpeg':webp?'image/webp':null;
 if(!actual||mime!==actual)refused('IMAGE_MAGIC_OR_MIME_REFUSED',415);
 return actual;
}
function sanitizeString(raw,min,max,field){
 if(typeof raw!=='string')refused('INVALID_'+field);
 const t=raw.trim().replace(/\s+/g,' ');
 if(t.length<min||t.length>max||/[\u0000-\u001f\u007f]/.test(t))
  refused('INVALID_'+field);
 return t;
}
function draftFromBody(body,creatorId){
 if(!CREATORS.has(creatorId))refused('CREATOR_AUTH_REQUIRED',401);
 if(!body||typeof body!=='object'||Array.isArray(body))refused('INVALID_JSON');
 for(const key of Object.keys(body))if(!ALLOWED_KEYS.has(key))
  refused('FORBIDDEN_CREATOR_FIELD_'+key,403);
 if(body.rights_confirmed!==true)refused('ARTWORK_RIGHTS_REQUIRED',403);
 const title=sanitizeString(body.title,2,90,'TITLE');
 const slot=sanitizeString(body.slot,2,30,'SLOT');
 if(!SLOTS.has(slot))refused('INVALID_SLOT');
 const artist=sanitizeString(body.artist_credit,2,90,'ARTIST');
 const file=sanitizeString(body.filename,1,110,'FILENAME');
 if(file.includes('/')||file.includes('\\')||file.startsWith('.'))
  refused('INVALID_FILENAME');
 const notes=body.notes?sanitizeString(body.notes,1,500,'NOTES'):'';
 const originKind=body.origin_kind||'hand_drawn';
 if(!['hand_drawn','ai_enhanced'].includes(originKind))
  refused('INVALID_ORIGIN_KIND');
 const parentDraftId=body.parent_draft_id||null;
 if(originKind==='ai_enhanced'){
  const prefix='ASSET-'+creatorId.toUpperCase()+'-';
  if(typeof parentDraftId!=='string'||!parentDraftId.startsWith(prefix)||
   parentDraftId.length!==prefix.length+20||
   !/^[A-F0-9]+$/.test(parentDraftId.slice(prefix.length)))
   refused('PARENT_ORIGINAL_REQUIRED');
 }else if(parentDraftId!==null){
  refused('ORIGINAL_CANNOT_HAVE_PARENT');
 }
 if(typeof body.base64!=='string'||body.base64.length>Math.ceil(LIMIT/3)*4+8||
  !/^[A-Za-z0-9+/]+={0,2}$/.test(body.base64))
  refused('INVALID_IMAGE_BASE64',413);
 const buffer=Buffer.from(body.base64,'base64');
 if(buffer.length===0||buffer.length>LIMIT||buffer.toString('base64')!==body.base64)
  refused('IMAGE_SIZE_OR_ENCODING_REFUSED',413);
 const mime=mediaType(buffer,body.mime);
 const hash=sha256(buffer);
 const draftId='ASSET-'+creatorId.toUpperCase()+'-'+hash.slice(0,20).toUpperCase();
 const metadata={
  title,slot,artist,file,notes,mime,sha256:hash,creator:creatorId,
  silo:'SILO_AVATAR',origin_kind:originKind,parent_draft_id:parentDraftId,
  render_targets:['dreamiez','kelp-atlantis']
 };
 return {draftId,creatorId,siloId:'SILO_AVATAR',title,slot,artist,file,notes,mime,
  hash,base64:body.base64,originKind,parentDraftId,
  metaHash:sha256(Buffer.from(JSON.stringify(metadata),'utf8')),
  bytes:buffer.length,status:'DRAFT',checkout_available:false,approval_required:true};
}
module.exports={LIMIT,authorize,verifyOrigin,draftFromBody,sha256,mediaType};
