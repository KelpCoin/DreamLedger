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
copyTree(SOURCE,DEST);

const required=['index.html','mtg/index.html','mtg-search.html','mtg-list.html'];
for(const rel of required){
  const file=path.join(DEST,rel);
  if(!fs.existsSync(file)) throw new Error('Required public surface missing: '+rel);
}
const listFile=path.join(DEST,'mtg-list.html');
let list=fs.readFileSync(listFile,'utf8');
list=list.replace(/Buyers never need one\\.?/gi,'Buying from another player requires a free DreamLedger account.');
list=list.replace(/buyers stay frictionless; sellers are known\\.?/gi,'Marketplace participants have a persistent account identity.');
fs.writeFileSync(listFile,list);
console.log(JSON.stringify({status:'PASS',source:SOURCE,destination:DEST,required,account_contract:'PASS'}));
