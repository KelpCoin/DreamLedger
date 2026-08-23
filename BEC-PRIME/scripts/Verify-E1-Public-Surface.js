'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'compiled', 'website', 'index.html');
const PROOF_DIR = path.join(ROOT, 'RUN-PROOFS');
const PROOF = path.join(PROOF_DIR, 'E1-PUBLIC-SURFACE-PROOF.json');

const REQUIRED = [
  'DreamLedger',
  'Horizontal catalogue',
  'MTG / CUBE silo',
  'DreamLedger Cinema',
  'Digital Products',
  'DreamMee Avatar',
  'href="/mtg"',
  'href="/cinema.html"',
  'href="/digital-products.html"',
  'href="/avatar.html"'
];

const FORBIDDEN = [
  'Dream Ledger Deck',
  'Agentic Commerce Readiness Audit',
  'One offer. One price.',
  'Buy the Diagnostic - NZ$29',
  'CollectorsCoast',
  'HappyHomarid',
  'Amplissa'
];

function sha256(value){return crypto.createHash('sha256').update(value, 'utf8').digest('hex');}
function fail(message){console.error(JSON.stringify({status:'FAIL',error:message},null,2));process.exit(1);}

if(!fs.existsSync(INDEX)) fail('public index is missing: '+INDEX);
const html = fs.readFileSync(INDEX,'utf8');
const lower = html.toLowerCase();
const missing = REQUIRED.filter(x=>!lower.includes(x.toLowerCase()));
const leaked = FORBIDDEN.filter(x=>lower.includes(x.toLowerCase()));

const proof = {
  schema:'dreamledger-public-catalogue-surface-proof-v2',
  status:missing.length===0&&leaked.length===0?'PASS':'FAIL',
  generated_at:new Date().toISOString(),
  source:'BEC-PRIME/compiled/website/index.html',
  sha256:sha256(html),
  required_present:REQUIRED.map(x=>({token:x,present:lower.includes(x.toLowerCase())})),
  forbidden_absent:FORBIDDEN.map(x=>({token:x,absent:!lower.includes(x.toLowerCase())})),
  missing_required:missing,
  leaked_forbidden:leaked
};

fs.mkdirSync(PROOF_DIR,{recursive:true});
fs.writeFileSync(PROOF,JSON.stringify(proof,null,2)+'\n','utf8');
console.log(JSON.stringify({...proof,proof_path:PROOF},null,2));
if(proof.status!=='PASS') process.exit(1);
