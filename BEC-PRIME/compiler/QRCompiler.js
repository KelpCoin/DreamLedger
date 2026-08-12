'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const ROOT=path.join(__dirname,'..');
const CATALOG=path.join(ROOT,'catalog','qr');
const OUT_DIR=path.join(ROOT,'compiled','qr');
const OUT=path.join(OUT_DIR,'index.json');
const forbidden=/(amplissa|bbw|big\s*beautiful\s*women|adult|explicit|lingerie|porn|sexual|plus[- ]size|curvy|body[- ]positive)/i;
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function walk(dir){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir).filter(x=>x.endsWith('.json')).map(x=>path.join(dir,x));}
function assertSafe(value,where){const text=JSON.stringify(value);if(forbidden.test(text))throw new Error(`SILO_BOUNDARY_VIOLATION:${where}`);}
function normalize(item,file){
  if(!item.id||!/^[a-zA-Z0-9_-]{3,32}$/.test(String(item.id)))throw new Error(`Invalid QR id in ${file}`);
  if(!item.destination||!/^https:\/\//i.test(String(item.destination)))throw new Error(`QR destination must be HTTPS in ${file}`);
  return {id:String(item.id),type:String(item.type||'url'),title:String(item.title||item.id),destination:String(item.destination),design:item.design||{},rules:item.rules||{},metadata:item.metadata||{},translate:item.translate||{enabled:false,target_languages:[]},status:item.status||'active'};
}
const files=walk(CATALOG);const records=[];const ids=new Set();
for(const file of files){const item=normalize(readJson(file),file);assertSafe(item,file);if(ids.has(item.id))throw new Error(`Duplicate QR id ${item.id}`);ids.add(item.id);records.push(item);}
records.sort((a,b)=>a.id.localeCompare(b.id));
const payload={schema:'dreamledger/qr-catalog/v1',generated_at:new Date().toISOString(),count:records.length,records,compiler_sha:crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex')};
fs.mkdirSync(OUT_DIR,{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(payload,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',output:'compiled/qr/index.json',count:records.length,compiler_sha:payload.compiler_sha},null,2));
