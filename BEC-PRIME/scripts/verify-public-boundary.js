'use strict';
const fs=require('fs');const path=require('path');
const ROOT=path.join(__dirname,'..');
const PUBLIC=path.join(ROOT,'compiled','website');
const forbidden=[
  ['sk','_live_'].join(''),['sk','_test_'].join(''),['whsec','_'].join(''),['cs','_live_'].join(''),
  'BEGIN RSA PRIVATE KEY','BEGIN OPENSSH PRIVATE KEY','BEGIN PRIVATE KEY','private conversation','customer_email',
  'DIGITAL_PROXY_APPROVAL_TOKEN','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','MARKETPLACE_ADMIN_TOKEN'
];
const errors=[];const scanned=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const name of fs.readdirSync(dir)){if(name==='.git'||name==='node_modules')continue;const p=path.join(dir,name);const s=fs.statSync(p);if(s.isDirectory())walk(p);else scanned.push(p);}}
walk(ROOT);
for(const p of scanned){let raw;try{raw=fs.readFileSync(p,'utf8');}catch{continue;}for(const term of forbidden){if(raw.includes(term)){const rel=path.relative(ROOT,p);if(!rel.startsWith('data/proofs'+path.sep))errors.push(`LEAK:${rel}:${term}`);}}}
if(fs.existsSync(PUBLIC)){for(const name of fs.readdirSync(PUBLIC)){const p=path.join(PUBLIC,name);if(fs.statSync(p).isDirectory()&&name==='.well-known')continue;}}
const result={schema:'dreamledger/public-boundary-proof/v1',verdict:errors.length?'FAIL':'PASS',scanned_files:scanned.map(x=>path.relative(ROOT,x)).sort(),errors,rule:'Secrets, payment credentials, customer PII, and private operational tokens are server-side only.'};
fs.mkdirSync(path.join(ROOT,'data','proofs'),{recursive:true});fs.writeFileSync(path.join(ROOT,'data','proofs','PUBLIC-BOUNDARY-PROOF.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(errors.length)process.exit(1);
