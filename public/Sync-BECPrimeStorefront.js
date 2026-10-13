'use strict';

const fs=require('fs');
const path=require('path');

const SOURCE=path.join(__dirname,'..','BEC-PRIME','compiled','website');
const DEST=__dirname;
const ALLOWED=new Set(['.html','.css','.js','.svg','.png','.jpg','.jpeg','.webp','.ico','.txt','.xml','.json']);

function copyTree(src,dst){
  for(const entry of fs.readdirSync(src,{withFileTypes:true})){
    const from=path.join(src,entry.name);
    const to=path.join(dst,entry.name);
    if(entry.isDirectory()){
      if(entry.name==='.well-known') continue;
      fs.mkdirSync(to,{recursive:true});
      copyTree(from,to);
    }else if(ALLOWED.has(path.extname(entry.name).toLowerCase()) && !['catalog.json','server.js','package.json','package-lock.json'].includes(entry.name)){
      fs.copyFileSync(from,to);
    }
  }
}

if(!fs.existsSync(SOURCE)) throw new Error('BEC-PRIME compiled website missing. Run npm run compile first.');
const canonicalPublicFiles=['avatar.html','billboard.html'];
const canonicalSnapshots=new Map(canonicalPublicFiles.map(rel=>{
  const file=path.join(DEST,rel);
  return [rel,fs.existsSync(file)?fs.readFileSync(file):null];
}));
copyTree(SOURCE,DEST);
// Preserve the reviewed public storefront versions. The compiled legacy tree
// can overwrite both with older surfaces (including a stale billboard checkout).
for(const [rel,bytes] of canonicalSnapshots){
  if(bytes) fs.writeFileSync(path.join(DEST,rel),bytes);
}

function copyStage0File(rel){
  const from=path.join(__dirname,'..',rel);
  const to=path.join(DEST,rel);
  if(!fs.existsSync(from)) throw new Error('Required PhinHaven source missing: '+rel);
  fs.mkdirSync(path.dirname(to),{recursive:true});
  fs.copyFileSync(from,to);
}
// Render's production storefront serves public/ as its root. Mirror the
// repository-level TEST pages into that served tree without changing their
// TEST/localStorage labels or implying production multiplayer.
for(const rel of ['phinhaven.html','phinhaven/hotel/index.html','phinhaven/shallows/index.html']){
  copyStage0File(rel);
}

const required=['index.html','mtg/index.html','mtg-search.html','mtg-list.html'];
for(const rel of required){
  const file=path.join(DEST,rel);
  if(!fs.existsSync(file)) throw new Error('Required public surface missing: '+rel);
}
const listFile=path.join(DEST,'mtg-list.html');
let list=fs.readFileSync(listFile,'utf8');
list=list.replace(/Buyers never need one\.?/gi,'Buying from another player requires a free DreamLedger account.');
list=list.replace(/buyers stay frictionless; sellers are known\.?/gi,'Marketplace participants have a persistent account identity.');
fs.writeFileSync(listFile,list);
console.log(JSON.stringify({status:'PASS',source:SOURCE,destination:DEST,required,account_contract:'PASS'}));
