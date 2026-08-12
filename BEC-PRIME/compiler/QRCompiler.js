'use strict';
const fs=require('fs');const path=require('path');const crypto=require('crypto');
const ROOT=path.join(__dirname,'..');const CATALOG=path.join(ROOT,'catalog','qr');const OUT_DIR=path.join(ROOT,'compiled','qr');const OUT=path.join(OUT_DIR,'index.json');
const allowedTypes=new Set(['url','vcard','wifi','email','sms','phone','event','text','location','social','app','crypto','file','payment']);
function read(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function files(dir){return fs.existsSync(dir)?fs.readdirSync(dir).filter(x=>x.endsWith('.json')).map(x=>path.join(dir,x)):[];}
function validate(q,file){if(!q.id||!/^[A-Za-z0-9_-]{3,32}$/.test(String(q.id)))throw Error(`Invalid QR id: ${file}`);if(!allowedTypes.has(String(q.type||'url')))throw Error(`Invalid QR type: ${file}`);if(!q.destination||!/^https:\/\//i.test(String(q.destination)))throw Error(`HTTPS destination required: ${file}`);}
const records=[];const ids=new Set();for(const file of files(CATALOG)){const q=read(file);validate(q,file);if(ids.has(q.id))throw Error(`Duplicate QR id: ${q.id}`);ids.add(q.id);records.push(q);}records.sort((a,b)=>a.id.localeCompare(b.id));
const source=JSON.stringify(records);const payload={schema:'dreamledger/qr-catalog/v1',generated_at:new Date().toISOString(),count:records.length,records,source_hash:crypto.createHash('sha256').update(source).digest('hex')};fs.mkdirSync(OUT_DIR,{recursive:true});fs.writeFileSync(OUT,JSON.stringify(payload,null,2)+'\n');console.log(JSON.stringify({status:'PASS',count:records.length,source_hash:payload.source_hash},null,2));
