'use strict';
const fs=require('fs');const path=require('path');
const ROOT=path.join(__dirname,'..');
const PUBLIC=path.join(ROOT,'compiled','website');
const forbidden=[/[s][k]_[l]ive_[A-Za-z0-9]/,/[s][k]_[t]est_[A-Za-z0-9]/,/[w]hsec_[A-Za-z0-9]/,/[c]s_[l]ive_[A-Za-z0-9]/,/BEGIN RSA PRIVATE KEY/,/BEGIN OPENSSH PRIVATE KEY/,/BEGIN PRIVATE KEY/];
const errors=[];const scanned=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const name of fs.readdirSync(dir)){if(name==='.git'||name==='node_modules')continue;const p=path.join(dir,name);const s=fs.statSync(p);if(s.isDirectory())walk(p);else scanned.push(p);}}
walk(ROOT);
for(const p of scanned){let raw;try{raw=fs.readFileSync(p,'utf8');}catch{continue;}for(const re of forbidden){if(re.test(raw)){const rel=path.relative(ROOT,p);if(!rel.startsWith('data/proofs'+path.sep))errors.push(`LEAK:${rel}:${re}`);}}}
if(!fs.existsSync(PUBLIC))errors.push('MISSING:compiled/website');
const result={schema:'dreamledger/public-boundary-proof/v1',verdict:errors.length?'FAIL':'PASS',scanned_files:scanned.map(x=>path.relative(ROOT,x)).sort(),errors,rule:'Secret values and private-key material are never committed to the public repository or served from the public surface.'};
fs.mkdirSync(path.join(ROOT,'data','proofs'),{recursive:true});fs.writeFileSync(path.join(ROOT,'data','proofs','PUBLIC-BOUNDARY-PROOF.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(errors.length)process.exit(1);
