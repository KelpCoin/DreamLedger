'use strict';
// A strict data boundary for the read-only BECK refinement runner.
// Do NOT promote untrusted HTML, scraped text, catalogue descriptions or comments to instructions.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..');
const FILES=Object.freeze([
 'public/index.html','public/go/index.html','public/marketplace.html',
 'public/avatar.html','public/shop.html','public/quote-compare-49.html',
 'IP/DreamMeez/shadow-cosmetics-20261028.json',
 'IP/DreamMeez/usp-201-203-free-identity.json'
]);
function sha256(v){return crypto.createHash('sha256').update(v).digest('hex');}
function structuralMetadata(relative,readFile=fs.readFileSync){
 if(!FILES.includes(relative))throw new Error('UNAPPROVED_REFINEMENT_SOURCE');
 const absolute=path.resolve(ROOT,relative);
 if(!absolute.startsWith(ROOT+path.sep))throw new Error('SOURCE_PATH_ESCAPE');
 let raw;
 try{raw=readFile(absolute,'utf8');}
 catch(e){return {file:relative,status:'UNAVAILABLE'};}
 if(typeof raw!=='string')throw new Error('INVALID_SOURCE');
 const result={file:relative,sha256:sha256(raw),bytes:Buffer.byteLength(raw)};
 if(relative.endsWith('.json')){
  let parsed;
  try{parsed=JSON.parse(raw);}catch{return {...result,status:'INVALID_JSON'};}
  result.status='STRUCTURED_ONLY';
  result.record_count=Array.isArray(parsed.items)?parsed.items.length:0;
  result.approval_required=parsed.automatic_publication===false;
  result.checkout_enabled=parsed.checkout_enabled===true;
  return result;
 }
 result.status='STRUCTURAL_ONLY';
 const tags=['h1','h2','a','button','form','nav','input','select','main'];
 for(const tag of tags)result['count_'+tag]=((raw.match(new RegExp('<'+tag+'(?:\\s|>)','gi')))||[]).length;
 // Only known, same-origin route strings enter the model, never link labels or URLs.
 const routes=new Set();
 const routeRe=/\bhref\s*=\s*["'](\/[a-z0-9/_#.?=&-]{0,110})["']/gi;
 let match;
 while((match=routeRe.exec(raw))!==null){
  const candidate=match[1].split('?')[0].split('#')[0];
  if(candidate.startsWith('/')&&!candidate.startsWith('//'))routes.add(candidate);
 }
 result.internal_routes=[...routes].sort().slice(0,32);
 return result;
}
function buildRefinementInput(readFile=fs.readFileSync){
 return JSON.stringify({
  schema:'beck/llm-structural-input/v1',
  trust:'UNTRUSTED_SOURCE_AS_DATA_NOT_INSTRUCTION',
  no_raw_html:true,no_external_text:true,no_customer_data:true,
  sources:FILES.map(file=>structuralMetadata(file,readFile))
 });
}
module.exports={FILES,structuralMetadata,buildRefinementInput};
