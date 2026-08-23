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
  'DREAMLEDGER / CATALOG',
  'Swipe the catalog.',
  'Digital goods',
  'Magic: The Gathering',
  'DreamMeez identity',
  'Deterministic Cinema',
  'marketplace-live.js',
  'COMMANDER-DECK-DIAGNOSTIC-001',
  'NZ$29',
  'https://buy.stripe.com/9B6aEX5DvdSd4Q73gwdwc1V',
  'Private implementation material is not a public surface.'
];

const FORBIDDEN = [
  'Dream Ledger Deck',
  'Amplissa',
  'HappyHomarid',
  'CollectorsCoast',
  'stripe_secret_key',
  'stripe_webhook_secret',
  '/var/data/'
];

function sha256(value){return crypto.createHash('sha256').update(value,'utf8').digest('hex');}
function fail(message){console.error(JSON.stringify({status:'FAIL',error:message},null,2));process.exit(1);}

if(!fs.existsSync(INDEX)) fail('public index is missing: '+INDEX);
const html=fs.readFileSync(INDEX,'utf8');
const lower=html.toLowerCase();
const missing=REQUIRED.filter(x=>!lower.includes(x.toLowerCase()));
const leaked=FORBIDDEN.filter(x=>lower.includes(x.toLowerCase()));
const routeChecks={
  mtg:lower.includes('href="/mtg"'),
  digital_products:lower.includes('href="/digital-products.html"'),
  avatar:lower.includes('href="/avatar.html"'),
  cinema:lower.includes('href="/cinema.html"'),
  marketplace:lower.includes('href="/marketplace.html"')
};
const routeFailures=Object.keys(routeChecks).filter(k=>!routeChecks[k]);

const proof={
  schema:'dreamledger-public-catalog-surface-proof-v2',
  status:missing.length===0&&leaked.length===0&&routeFailures.length===0?'PASS':'FAIL',
  generated_at:new Date().toISOString(),
  source:'BEC-PRIME/compiled/website/index.html',
  sha256:sha256(html),
  required_present:REQUIRED.map(x=>({token:x,present:lower.includes(x.toLowerCase())})),
  forbidden_absent:FORBIDDEN.map(x=>({token:x,absent:!lower.includes(x.toLowerCase())})),
  silo_routes:routeChecks,
  missing_required:missing,
  leaked_forbidden:leaked,
  route_failures:routeFailures
};

fs.mkdirSync(PROOF_DIR,{recursive:true});
fs.writeFileSync(PROOF,JSON.stringify(proof,null,2)+'\n','utf8');
console.log(JSON.stringify({...proof,proof_path:PROOF},null,2));
if(proof.status!=='PASS')process.exit(1);
